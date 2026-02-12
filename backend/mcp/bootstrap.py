"""
MCP Bootstrap
도구 자동 등록 및 초기화
"""
import logging
from .registry import get_registry
from .tools.weather import WeatherTool
from .tools.trends import TrendsTool
from .tools.rag import RAGTool, RAGSearchTool
from .tools.rag_advanced import AdvancedRAGTool

logger = logging.getLogger("pawpalja.mcp.bootstrap")


def register_all_tools():
    """모든 MCP 도구를 레지스트리에 등록"""
    registry = get_registry()

    tools = [
        WeatherTool,
        TrendsTool,
        RAGTool,
        RAGSearchTool,
        AdvancedRAGTool,
    ]

    for tool_class in tools:
        registry.register(
            name=tool_class.NAME,
            handler=tool_class.execute,
            version=tool_class.VERSION,
            description=tool_class.DESCRIPTION,
            category=tool_class.CATEGORY,
            parameters=tool_class.PARAMETERS,
            returns=tool_class.RETURNS,
        )

    logger.info(f"총 {len(tools)}개 MCP 도구 등록 완료")

    return registry


def initialize_mcp():
    """MCP 시스템 초기화

    Returns:
        초기화된 ToolRegistry
    """
    logger.info("MCP 시스템 초기화 시작...")

    # 도구 등록
    registry = register_all_tools()

    # 통계 로깅
    stats = registry.get_stats()
    logger.info(f"MCP 초기화 완료: {stats['total_tools']}개 도구, {len(stats['categories'])}개 카테고리")

    return registry


# 모듈 임포트 시 자동 초기화
try:
    initialize_mcp()
except Exception as e:
    logger.error(f"MCP 초기화 실패: {e}")
