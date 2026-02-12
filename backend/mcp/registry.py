"""
MCP Tool Registry
도구 등록, 관리, 버전 관리 시스템
"""
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger("pawpalja.mcp.registry")


@dataclass
class ToolMetadata:
    """도구 메타데이터"""
    name: str
    version: str
    description: str
    category: str  # "external_api", "file_system", "rag", "computation"
    parameters: Dict[str, Any]
    returns: Dict[str, Any]
    registered_at: datetime = field(default_factory=datetime.now)
    enabled: bool = True
    usage_count: int = 0
    error_count: int = 0


@dataclass
class ToolDefinition:
    """도구 정의"""
    metadata: ToolMetadata
    handler: Callable
    middleware: List[Callable] = field(default_factory=list)


class ToolRegistry:
    """MCP Tool Registry - 도구 중앙 관리 시스템"""

    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._categories: Dict[str, List[str]] = {}
        logger.info("ToolRegistry 초기화 완료")

    def register(
        self,
        name: str,
        handler: Callable,
        version: str = "1.0.0",
        description: str = "",
        category: str = "general",
        parameters: Optional[Dict[str, Any]] = None,
        returns: Optional[Dict[str, Any]] = None,
        middleware: Optional[List[Callable]] = None,
    ) -> None:
        """도구 등록

        Args:
            name: 도구 이름 (고유 식별자)
            handler: 도구 실행 함수
            version: 버전 (semantic versioning)
            description: 설명
            category: 카테고리
            parameters: 파라미터 스키마
            returns: 반환 타입 스키마
            middleware: 실행 전후 처리 함수 리스트
        """
        if name in self._tools:
            logger.warning(f"도구 '{name}' 이미 등록됨. 기존 도구를 덮어씁니다.")

        metadata = ToolMetadata(
            name=name,
            version=version,
            description=description or handler.__doc__ or "설명 없음",
            category=category,
            parameters=parameters or {},
            returns=returns or {},
        )

        definition = ToolDefinition(
            metadata=metadata,
            handler=handler,
            middleware=middleware or [],
        )

        self._tools[name] = definition

        # 카테고리별 인덱스 업데이트
        if category not in self._categories:
            self._categories[category] = []
        if name not in self._categories[category]:
            self._categories[category].append(name)

        logger.info(f"도구 등록: {name} v{version} (category: {category})")

    def unregister(self, name: str) -> bool:
        """도구 등록 해제

        Args:
            name: 도구 이름

        Returns:
            성공 여부
        """
        if name not in self._tools:
            logger.warning(f"도구 '{name}' 미등록 상태")
            return False

        tool = self._tools[name]
        category = tool.metadata.category

        # 카테고리 인덱스에서 제거
        if category in self._categories and name in self._categories[category]:
            self._categories[category].remove(name)

        # 도구 제거
        del self._tools[name]
        logger.info(f"도구 등록 해제: {name}")
        return True

    def get(self, name: str) -> Optional[ToolDefinition]:
        """도구 조회

        Args:
            name: 도구 이름

        Returns:
            ToolDefinition 또는 None
        """
        return self._tools.get(name)

    def list_tools(self, category: Optional[str] = None, enabled_only: bool = True) -> List[str]:
        """등록된 도구 목록 조회

        Args:
            category: 카테고리 필터 (None이면 전체)
            enabled_only: 활성화된 도구만 반환

        Returns:
            도구 이름 리스트
        """
        if category:
            tools = self._categories.get(category, [])
        else:
            tools = list(self._tools.keys())

        if enabled_only:
            tools = [name for name in tools if self._tools[name].metadata.enabled]

        return tools

    def get_metadata(self, name: str) -> Optional[ToolMetadata]:
        """도구 메타데이터 조회

        Args:
            name: 도구 이름

        Returns:
            ToolMetadata 또는 None
        """
        tool = self._tools.get(name)
        return tool.metadata if tool else None

    def enable(self, name: str) -> bool:
        """도구 활성화"""
        if name not in self._tools:
            return False
        self._tools[name].metadata.enabled = True
        logger.info(f"도구 활성화: {name}")
        return True

    def disable(self, name: str) -> bool:
        """도구 비활성화"""
        if name not in self._tools:
            return False
        self._tools[name].metadata.enabled = False
        logger.info(f"도구 비활성화: {name}")
        return True

    def execute(self, name: str, **kwargs) -> Any:
        """도구 실행

        Args:
            name: 도구 이름
            **kwargs: 도구 파라미터

        Returns:
            도구 실행 결과

        Raises:
            ValueError: 도구가 등록되지 않았거나 비활성화됨
            Exception: 도구 실행 중 오류
        """
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"도구 '{name}' 미등록")

        if not tool.metadata.enabled:
            raise ValueError(f"도구 '{name}' 비활성화 상태")

        try:
            # Middleware: pre-execution
            context = {"name": name, "params": kwargs}
            for middleware in tool.middleware:
                middleware(context, phase="pre")

            # 도구 실행
            result = tool.handler(**kwargs)

            # Middleware: post-execution
            context["result"] = result
            for middleware in tool.middleware:
                middleware(context, phase="post")

            # 통계 업데이트
            tool.metadata.usage_count += 1

            return result

        except Exception as e:
            tool.metadata.error_count += 1
            logger.error(f"도구 실행 오류 ({name}): {e}")
            raise

    def get_stats(self) -> Dict[str, Any]:
        """레지스트리 통계 조회

        Returns:
            통계 딕셔너리
        """
        total_tools = len(self._tools)
        enabled_tools = len([t for t in self._tools.values() if t.metadata.enabled])
        total_usage = sum(t.metadata.usage_count for t in self._tools.values())
        total_errors = sum(t.metadata.error_count for t in self._tools.values())

        category_stats = {}
        for category, tools in self._categories.items():
            category_stats[category] = len(tools)

        return {
            "total_tools": total_tools,
            "enabled_tools": enabled_tools,
            "disabled_tools": total_tools - enabled_tools,
            "total_usage": total_usage,
            "total_errors": total_errors,
            "categories": category_stats,
            "tools": {
                name: {
                    "version": tool.metadata.version,
                    "category": tool.metadata.category,
                    "enabled": tool.metadata.enabled,
                    "usage_count": tool.metadata.usage_count,
                    "error_count": tool.metadata.error_count,
                }
                for name, tool in self._tools.items()
            },
        }


# 전역 레지스트리 인스턴스
_global_registry = ToolRegistry()


def get_registry() -> ToolRegistry:
    """전역 레지스트리 인스턴스 반환"""
    return _global_registry
