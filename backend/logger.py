"""
Structured Logging System
JSON 로그 포맷, 로그 레벨별 분리, 에러 추적
"""
import logging
import logging.config
import json
from datetime import datetime
from typing import Any, Dict
import os


class JSONFormatter(logging.Formatter):
    """JSON 포맷 로거"""

    def format(self, record: logging.LogRecord) -> str:
        """로그 레코드를 JSON으로 포맷팅

        Args:
            record: 로그 레코드

        Returns:
            JSON 문자열
        """
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Exception 정보 추가
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        # 추가 필드 (extra) — request context
        _extra_fields = [
            "user_id", "request_id", "agent_name", "tool_name",
            "method", "path", "status_code", "duration_ms",
        ]
        for field in _extra_fields:
            if hasattr(record, field):
                log_data[field] = getattr(record, field)

        return json.dumps(log_data, ensure_ascii=False)


def setup_logging(
    log_level: str = "INFO",
    log_dir: str = "logs",
    json_format: bool = True
):
    """로깅 시스템 설정

    Args:
        log_level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: 로그 파일 저장 디렉토리
        json_format: JSON 포맷 사용 여부
    """
    # 로그 디렉토리 생성
    os.makedirs(log_dir, exist_ok=True)

    # 로그 설정
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JSONFormatter,
            },
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "standard" if not json_format else "json",
                "stream": "ext://sys.stdout",
            },
            "file_all": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "DEBUG",
                "formatter": "json",
                "filename": os.path.join(log_dir, "all.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
            "file_error": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "json",
                "filename": os.path.join(log_dir, "error.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
            "file_agent": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "INFO",
                "formatter": "json",
                "filename": os.path.join(log_dir, "agent.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "": {  # Root logger
                "level": "DEBUG",
                "handlers": ["console", "file_all", "file_error"],
            },
            "pawpalja": {  # 앱 전용 로거
                "level": "DEBUG",
                "handlers": ["console", "file_all", "file_error"],
                "propagate": False,
            },
            "pawpalja.agents": {  # Agent 전용 로거
                "level": "DEBUG",
                "handlers": ["file_agent"],
                "propagate": True,
            },
            "pawpalja.mcp": {  # MCP 전용 로거
                "level": "DEBUG",
                "handlers": ["console", "file_all"],
                "propagate": True,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
        },
    }

    logging.config.dictConfig(config)

    # 초기화 로그
    logger = logging.getLogger("pawpalja")
    logger.info(f"로깅 시스템 초기화 완료 (level={log_level}, json_format={json_format})")


def get_logger(name: str) -> logging.Logger:
    """로거 인스턴스 반환

    Args:
        name: 로거 이름 (일반적으로 __name__ 사용)

    Returns:
        Logger 인스턴스
    """
    return logging.getLogger(f"pawpalja.{name}")


# Context Manager for Request Logging
class RequestLoggingContext:
    """요청별 로깅 컨텍스트"""

    def __init__(self, request_id: str, user_id: str = None):
        self.request_id = request_id
        self.user_id = user_id
        self.logger = get_logger("request")

    def __enter__(self):
        self.logger.info(
            f"요청 시작",
            extra={"request_id": self.request_id, "user_id": self.user_id}
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.logger.error(
                f"요청 실패: {exc_val}",
                extra={"request_id": self.request_id, "user_id": self.user_id},
                exc_info=(exc_type, exc_val, exc_tb)
            )
        else:
            self.logger.info(
                f"요청 완료",
                extra={"request_id": self.request_id, "user_id": self.user_id}
            )


if __name__ == "__main__":
    # 테스트
    setup_logging(log_level="DEBUG", json_format=True)

    logger = get_logger("test")
    logger.debug("디버그 메시지")
    logger.info("정보 메시지")
    logger.warning("경고 메시지")
    logger.error("에러 메시지")

    try:
        raise ValueError("테스트 예외")
    except Exception as e:
        logger.exception("예외 발생")

    # Request context
    with RequestLoggingContext("test-req-001", "user123"):
        logger.info("요청 처리 중", extra={"request_id": "test-req-001"})
