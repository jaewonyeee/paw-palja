"""
MCP Server Implementation
Model Context Protocol 표준 서버
"""
from typing import Dict, Any, Optional, List
import logging
from .registry import ToolRegistry, get_registry

logger = logging.getLogger("pawpalja.mcp.server")


class MCPServer:
    """MCP (Model Context Protocol) Server

    표준화된 도구 실행 서버. 도구 등록, 실행, 관리 기능 제공.
    """

    def __init__(self, registry: Optional[ToolRegistry] = None):
        """MCP Server 초기화

        Args:
            registry: ToolRegistry 인스턴스 (None이면 전역 레지스트리 사용)
        """
        self.registry = registry or get_registry()
        self._session_id = None
        logger.info("MCPServer 초기화 완료")

    def initialize(self, session_id: str) -> Dict[str, Any]:
        """서버 초기화 및 세션 시작

        Args:
            session_id: 세션 ID

        Returns:
            초기화 응답
        """
        self._session_id = session_id
        available_tools = self.list_available_tools()

        logger.info(f"MCP 세션 시작: {session_id}, 사용 가능한 도구: {len(available_tools)}개")

        return {
            "protocol_version": "1.0.0",
            "server_name": "Paw-Palja MCP Server",
            "session_id": session_id,
            "capabilities": {
                "tools": True,
                "resources": True,
                "prompts": True,
            },
            "available_tools": available_tools,
        }

    def list_available_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """사용 가능한 도구 목록 조회

        Args:
            category: 카테고리 필터 (None이면 전체)

        Returns:
            도구 메타데이터 리스트
        """
        tool_names = self.registry.list_tools(category=category, enabled_only=True)

        tools_info = []
        for name in tool_names:
            metadata = self.registry.get_metadata(name)
            if metadata:
                tools_info.append({
                    "name": metadata.name,
                    "version": metadata.version,
                    "description": metadata.description,
                    "category": metadata.category,
                    "parameters": metadata.parameters,
                    "returns": metadata.returns,
                })

        return tools_info

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """도구 실행 (MCP 표준 호출)

        Args:
            tool_name: 도구 이름
            arguments: 도구 파라미터

        Returns:
            MCP 표준 응답
        """
        try:
            result = self.registry.execute(tool_name, **arguments)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": str(result),
                    }
                ],
                "isError": False,
            }
        except ValueError as e:
            logger.error(f"도구 호출 오류 ({tool_name}): {e}")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"오류: {str(e)}",
                    }
                ],
                "isError": True,
            }
        except Exception as e:
            logger.exception(f"도구 실행 중 예외 ({tool_name})")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"실행 오류: {str(e)}",
                    }
                ],
                "isError": True,
            }

    def get_server_info(self) -> Dict[str, Any]:
        """서버 정보 조회

        Returns:
            서버 정보 및 통계
        """
        stats = self.registry.get_stats()

        return {
            "session_id": self._session_id,
            "protocol_version": "1.0.0",
            "server_name": "Paw-Palja MCP Server",
            "registry_stats": stats,
        }

    def shutdown(self) -> Dict[str, Any]:
        """서버 종료

        Returns:
            종료 응답
        """
        logger.info(f"MCP 세션 종료: {self._session_id}")

        return {
            "session_id": self._session_id,
            "message": "서버가 정상적으로 종료되었습니다.",
        }


# 전역 MCP 서버 인스턴스
_global_server = MCPServer()


def get_mcp_server() -> MCPServer:
    """전역 MCP 서버 인스턴스 반환"""
    return _global_server
