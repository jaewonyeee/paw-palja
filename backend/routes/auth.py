"""
인증 관련 API 라우터 (회원가입, 로그인, 사용자 관리)
"""
from fastapi import APIRouter, HTTPException
from backend.schemas import DogProfile, LoginRequest, SignupRequest
from backend import user_store

router = APIRouter()


@router.post("/auth/signup")
async def auth_signup(req: SignupRequest):
    result = user_store.signup(req.user_id, req.nickname, req.password, req.dog.model_dump(), req.diary_time)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/auth/check-id/{user_id}")
async def check_id(user_id: str):
    """아이디 중복 확인"""
    if user_store._validate_user_id(user_id):
        return {"available": False}
    existing = user_store.get_user(user_id)
    return {"available": existing is None}


@router.post("/auth/login")
async def auth_login(req: LoginRequest):
    result = user_store.login(req.user_id, req.password)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@router.get("/user/{user_id}")
async def get_user(user_id: str):
    user = user_store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return user


@router.put("/user/{user_id}")
async def update_user(user_id: str, dog: DogProfile = None, diary_time: str = None):
    result = user_store.update_user(user_id, dog.model_dump() if dog else None, diary_time)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
