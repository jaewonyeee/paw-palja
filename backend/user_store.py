"""
사용자 세션 및 다이어리 저장소
JSON 파일 기반 간이 영속 스토어 (프로토타입용)
"""
import os
import re
import json
import uuid
import fcntl
import logging
from datetime import datetime
from contextlib import contextmanager

import bcrypt

logger = logging.getLogger("pawpalja.store")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STORE_DIR = os.path.join(BASE_DIR, "data", "users")

# SEC-008: user_id 허용 패턴 (영문+숫자, 3~30자)
_VALID_USER_ID = re.compile(r"^[a-zA-Z0-9]{3,30}$")


def _ensure_dir():
    os.makedirs(STORE_DIR, exist_ok=True)


def _validate_user_id(user_id: str) -> str | None:
    """user_id를 검증합니다. 유효하지 않으면 에러 메시지를 반환합니다."""
    if not user_id or not _VALID_USER_ID.match(user_id):
        return "아이디는 영문과 숫자 3~30자만 사용 가능합니다."
    return None


# SEC-003: bcrypt 비밀번호 해싱
def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_pw(password: str, hashed: str) -> bool:
    """비밀번호 검증. SHA-256 레거시 해시도 호환 지원합니다."""
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        # SHA-256 레거시 해시 호환 (마이그레이션 기간)
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest() == hashed


def _user_path(user_id: str) -> str:
    return os.path.join(STORE_DIR, f"{user_id}.json")


def _diaries_path(user_id: str) -> str:
    return os.path.join(STORE_DIR, f"{user_id}_diaries.json")


# DATA-001: 파일 잠금을 통한 동시성 제어
@contextmanager
def _file_lock(path: str):
    """파일 단위 Advisory Lock (읽기-수정-쓰기 경합 방지)"""
    lock_path = path + ".lock"
    _ensure_dir()
    fd = open(lock_path, "w")
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        fd.close()


def signup(user_id: str, nickname: str, password: str, dog: dict, diary_time: str = "09:00") -> dict:
    _ensure_dir()
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}

    if os.path.exists(_user_path(user_id)):
        return {"error": "이미 사용 중인 아이디입니다."}

    user = {
        "user_id": user_id,
        "nickname": nickname,
        "password_hash": _hash_pw(password),
        "dog": dog,
        "diary_time": diary_time,
        "created_at": datetime.now().isoformat(),
    }
    with open(_user_path(user_id), "w", encoding="utf-8") as f:
        json.dump(user, f, ensure_ascii=False, indent=2)

    with open(_diaries_path(user_id), "w", encoding="utf-8") as f:
        json.dump([], f)

    return {"user_id": user_id, "nickname": nickname, "dog": dog, "diary_time": diary_time}


def login(user_id: str, password: str) -> dict:
    _ensure_dir()
    err = _validate_user_id(user_id)
    if err:
        return {"error": "아이디 또는 비밀번호가 올바르지 않습니다."}

    path = _user_path(user_id)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            u = json.load(fh)
            if _verify_pw(password, u.get("password_hash", "")):
                # 레거시 SHA-256 해시인 경우 bcrypt로 자동 마이그레이션
                if not u["password_hash"].startswith("$2"):
                    u["password_hash"] = _hash_pw(password)
                    with open(path, "w", encoding="utf-8") as fw:
                        json.dump(u, fw, ensure_ascii=False, indent=2)
                return {
                    "user_id": u["user_id"],
                    "nickname": u["nickname"],
                    "dog": u["dog"],
                    "diary_time": u.get("diary_time", "09:00"),
                }
    return {"error": "아이디 또는 비밀번호가 올바르지 않습니다."}


def get_user(user_id: str) -> dict | None:
    if _validate_user_id(user_id):
        return None
    path = _user_path(user_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        u = json.load(f)
    return {
        "user_id": u["user_id"],
        "nickname": u["nickname"],
        "dog": u["dog"],
        "diary_time": u.get("diary_time", "09:00"),
    }


def update_user(user_id: str, dog: dict = None, diary_time: str = None) -> dict:
    if _validate_user_id(user_id):
        return {"error": "사용자를 찾을 수 없습니다."}
    path = _user_path(user_id)
    with _file_lock(path):
        if not os.path.exists(path):
            return {"error": "사용자를 찾을 수 없습니다."}
        with open(path, "r", encoding="utf-8") as f:
            u = json.load(f)
        if dog:
            u["dog"] = dog
        if diary_time:
            u["diary_time"] = diary_time
        with open(path, "w", encoding="utf-8") as f:
            json.dump(u, f, ensure_ascii=False, indent=2)
    return {"user_id": u["user_id"], "nickname": u["nickname"], "dog": u["dog"], "diary_time": u.get("diary_time")}


def save_diary_entry(user_id: str, entry: dict) -> dict:
    """일기를 저장합니다. 같은 날짜의 일기가 이미 존재하면 덮어씁니다."""
    _ensure_dir()
    path = _diaries_path(user_id)

    with _file_lock(path):
        diaries = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                diaries = json.load(f)

        today = datetime.now().strftime("%Y-%m-%d")
        entry["date"] = today
        entry["created_at"] = datetime.now().isoformat()

        existing_idx = None
        for i, d in enumerate(diaries):
            if d.get("date") == today:
                existing_idx = i
                break

        if existing_idx is not None:
            entry["entry_id"] = diaries[existing_idx].get("entry_id", str(uuid.uuid4()))
            diaries[existing_idx] = entry
        else:
            # DATA-002: 전체 UUID 사용 (충돌 방지)
            entry["entry_id"] = str(uuid.uuid4())
            diaries.insert(0, entry)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(diaries, f, ensure_ascii=False, indent=2)
    return entry


def get_diaries(user_id: str, limit: int = 30) -> list[dict]:
    if _validate_user_id(user_id):
        return []
    path = _diaries_path(user_id)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        diaries = json.load(f)
    # VAL: limit 상한 제한
    limit = min(limit, 100)
    return diaries[:limit]


def get_diary_by_id(user_id: str, entry_id: str) -> dict | None:
    diaries = get_diaries(user_id, limit=999)
    for d in diaries:
        if d.get("entry_id") == entry_id:
            return d
    return None


def update_diary_entry(user_id: str, entry_id: str, updates: dict) -> dict | None:
    path = _diaries_path(user_id)
    with _file_lock(path):
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            diaries = json.load(f)
        for i, d in enumerate(diaries):
            if d.get("entry_id") == entry_id:
                diaries[i].update(updates)
                diaries[i]["is_edited"] = True
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(diaries, f, ensure_ascii=False, indent=2)
                return diaries[i]
    return None


def delete_diary_entry(user_id: str, entry_id: str) -> bool:
    path = _diaries_path(user_id)
    with _file_lock(path):
        if not os.path.exists(path):
            return False
        with open(path, "r", encoding="utf-8") as f:
            diaries = json.load(f)
        new_diaries = [d for d in diaries if d.get("entry_id") != entry_id]
        if len(new_diaries) == len(diaries):
            return False
        with open(path, "w", encoding="utf-8") as f:
            json.dump(new_diaries, f, ensure_ascii=False, indent=2)
    return True


def clear_comments(user_id: str, entry_id: str) -> bool:
    path = _diaries_path(user_id)
    with _file_lock(path):
        if not os.path.exists(path):
            return False
        with open(path, "r", encoding="utf-8") as f:
            diaries = json.load(f)
        for i, d in enumerate(diaries):
            if d.get("entry_id") == entry_id:
                diaries[i]["comments"] = []
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(diaries, f, ensure_ascii=False, indent=2)
                return True
    return False


def add_comments_to_diary(user_id: str, entry_id: str, comments: list[dict]) -> bool:
    path = _diaries_path(user_id)
    with _file_lock(path):
        if not os.path.exists(path):
            return False
        with open(path, "r", encoding="utf-8") as f:
            diaries = json.load(f)
        for i, d in enumerate(diaries):
            if d.get("entry_id") == entry_id:
                existing = d.get("comments", [])
                existing.extend(comments)
                diaries[i]["comments"] = existing
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(diaries, f, ensure_ascii=False, indent=2)
                return True
    return False
