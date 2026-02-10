"""
ChromaDB Python 3.14 호환성 패치
Python 3.14에서 pydantic.v1의 type annotation 추론 실패 문제를 해결합니다.
이 모듈을 chromadb import 전에 반드시 import 해야 합니다.
"""
import sys

if sys.version_info >= (3, 14):
    import pydantic.v1.fields as _pf

    _original = _pf.ModelField._set_default_and_type

    def _patched(self):
        try:
            _original(self)
        except Exception:
            from typing import Any
            self.outer_type_ = Any
            self.type_ = Any

    _pf.ModelField._set_default_and_type = _patched
