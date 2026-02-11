"""
에이전트 단독 실행 및 분석 API 라우터
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Query, Request
from backend.schemas import (
    DogProfile, DailyLog, AnalysisRequest, AnalysisResponse,
    HoroscopeResult, DiaryResult, HealthAnalysis,
)
from backend.agents import build_agent_graph
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.agents")

router = APIRouter()

# Import limiter (set up in main.py, accessed via app.state)
from backend.rate_limit import limiter

_agent_graph = None


def _get_agent_graph():
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph


def _prepare_state(profile: DogProfile, logs: DailyLog):
    return {
        "dog_profile": profile.model_dump(),
        "daily_logs": logs.model_dump(),
        "messages": [],
        "agent_memos": [],
    }


@router.post("/analyze", response_model=AnalysisResponse)
@limiter.limit("3/minute")
async def analyze_full(request: Request, body: AnalysisRequest):
    """전체 분석: Oracle + Journalist + Vet 순차 실행"""
    try:
        initial_state = _prepare_state(body.profile, body.logs)
        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        final_state = _get_agent_graph().invoke(initial_state, config=config)

        return AnalysisResponse(
            horoscope=HoroscopeResult(**final_state["horoscope"]),
            diary=DiaryResult(**final_state["diary"]),
            health=HealthAnalysis(**final_state["health"]),
            agent_memos=final_state.get("agent_memos", []),
        )
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.post("/horoscope")
@limiter.limit("5/minute")
async def get_horoscope(request: Request, body: AnalysisRequest):
    """Oracle Agent만 단독 실행"""
    try:
        from backend.agents import oracle_agent
        state = _prepare_state(body.profile, body.logs)
        result = oracle_agent(state)
        return result["horoscope"]
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.post("/diary")
@limiter.limit("5/minute")
async def get_diary(request: Request, body: AnalysisRequest):
    """Journalist Agent만 단독 실행"""
    try:
        from backend.agents import journalist_agent
        state = _prepare_state(body.profile, body.logs)
        result = journalist_agent(state)
        return result["diary"]
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.post("/health")
@limiter.limit("5/minute")
async def get_health(request: Request, body: AnalysisRequest):
    """Vet Agent만 단독 실행"""
    try:
        from backend.agents import vet_agent
        state = _prepare_state(body.profile, body.logs)
        result = vet_agent(state)
        return result["health"]
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.post("/rag/ingest")
@limiter.limit("1/5minutes")
async def rag_ingest(request: Request):
    """RAG 데이터 재수집 및 ChromaDB 재적재"""
    try:
        from backend.rag_pipeline import build_vector_db
        result = build_vector_db()
        if result:
            return {"status": "success", "message": "벡터 DB 재구축 완료"}
        return {"status": "warning", "message": "인덱싱할 데이터가 없습니다"}
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.get("/rag/search")
async def rag_search(request: Request, q: str, k: int = Query(default=3, ge=1, le=20)):
    """RAG 벡터 검색 테스트"""
    try:
        from backend.rag_pipeline import query_rag
        results = query_rag(q, k=k)
        return {
            "query": q,
            "results": [
                {"content": r.page_content, "metadata": r.metadata}
                for r in results
            ],
        }
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))


@router.post("/sns/fetch")
@limiter.limit("2/minute")
async def sns_fetch(request: Request):
    """Apify를 통한 SNS 데이터 수집"""
    try:
        from backend.fetch_sns_data import fetch_multiple_tags, save_sns_data
        data = fetch_multiple_tags(max_per_tag=3)
        if data:
            save_sns_data(data)
            return {"status": "success", "count": len(data)}
        return {"status": "warning", "message": "수집된 데이터가 없습니다", "count": 0}
    except Exception as e:
        logger.exception("에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=get_message("processing_error", get_lang(request)))
