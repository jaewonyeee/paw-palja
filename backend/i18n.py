"""
Centralized multilingual (ko/en/ja/zh/es) error message registry for Paw-Palja backend.

Usage:
    from backend.i18n import get_message, get_lang
    lang = get_lang(request)
    msg = get_message("user_not_found", lang)
"""
from fastapi import Request

SUPPORTED_LANGUAGES = ("ko", "en", "ja", "zh", "es")

MESSAGES = {
    # --- user_store.py ---
    "invalid_user_id": {
        "ko": "아이디는 영문과 숫자 3~30자만 사용 가능합니다.",
        "en": "User ID must be 3-30 alphanumeric characters.",
        "ja": "ユーザーIDは英数字3〜30文字で入力してください。",
        "zh": "用户ID必须为3-30位英文数字字符。",
        "es": "El ID de usuario debe tener entre 3 y 30 caracteres alfanuméricos.",
    },
    "user_id_taken": {
        "ko": "이미 사용 중인 아이디입니다.",
        "en": "This user ID is already taken.",
        "ja": "このユーザーIDは既に使用されています。",
        "zh": "该用户ID已被使用。",
        "es": "Este ID de usuario ya está en uso.",
    },
    "invalid_credentials": {
        "ko": "아이디 또는 비밀번호가 올바르지 않습니다.",
        "en": "Invalid user ID or password.",
        "ja": "ユーザーIDまたはパスワードが正しくありません。",
        "zh": "用户ID或密码错误。",
        "es": "ID de usuario o contraseña inválidos.",
    },
    "user_not_found": {
        "ko": "사용자를 찾을 수 없습니다.",
        "en": "User not found.",
        "ja": "ユーザーが見つかりません。",
        "zh": "未找到用户。",
        "es": "Usuario no encontrado.",
    },
    # --- auth.py ---
    "invalid_token_algorithm": {
        "ko": "유효하지 않은 토큰 알고리즘입니다.",
        "en": "Invalid token algorithm",
        "ja": "無効なトークンアルゴリズムです。",
        "zh": "无效的令牌算法。",
        "es": "Algoritmo de token inválido.",
    },
    "token_expired": {
        "ko": "토큰이 만료되었습니다.",
        "en": "Token expired",
        "ja": "トークンの有効期限が切れました。",
        "zh": "令牌已过期。",
        "es": "Token expirado.",
    },
    "malformed_token": {
        "ko": "잘못된 형식의 토큰입니다.",
        "en": "Malformed token",
        "ja": "不正な形式のトークンです。",
        "zh": "令牌格式错误。",
        "es": "Token con formato incorrecto.",
    },
    "invalid_token": {
        "ko": "유효하지 않은 토큰입니다.",
        "en": "Invalid token",
        "ja": "無効なトークンです。",
        "zh": "无效的令牌。",
        "es": "Token inválido.",
    },
    "invalid_token_type": {
        "ko": "유효하지 않은 토큰 유형입니다.",
        "en": "Invalid token type",
        "ja": "無効なトークンタイプです。",
        "zh": "无效的令牌类型。",
        "es": "Tipo de token inválido.",
    },
    "invalid_token_payload": {
        "ko": "유효하지 않은 토큰 페이로드입니다.",
        "en": "Invalid token payload",
        "ja": "無効なトークンペイロードです。",
        "zh": "无效的令牌载荷。",
        "es": "Carga del token inválida.",
    },
    "admin_access_required": {
        "ko": "관리자 권한이 필요합니다.",
        "en": "Admin access required",
        "ja": "管理者権限が必要です。",
        "zh": "需要管理员权限。",
        "es": "Se requiere acceso de administrador.",
    },
    # --- routes/auth.py ---
    "token_reuse_detected": {
        "ko": "토큰 재사용이 감지되었습니다. 모든 세션이 해지되었습니다. 다시 로그인해주세요.",
        "en": "Token reuse detected. All sessions revoked. Please log in again.",
        "ja": "トークンの再利用が検出されました。すべてのセッションが無効になりました。再度ログインしてください。",
        "zh": "检测到令牌重用。所有会话已撤销。请重新登录。",
        "es": "Se detectó reutilización de token. Todas las sesiones fueron revocadas. Inicie sesión nuevamente.",
    },
    # --- routes/diary.py ---
    "diary_create_error": {
        "ko": "다이어리 생성 중 오류가 발생했습니다.",
        "en": "An error occurred while creating the diary.",
        "ja": "日記の作成中にエラーが発生しました。",
        "zh": "创建日记时发生错误。",
        "es": "Ocurrió un error al crear el diario.",
    },
    "diary_not_found": {
        "ko": "다이어리를 찾을 수 없습니다.",
        "en": "Diary not found.",
        "ja": "日記が見つかりません。",
        "zh": "未找到日记。",
        "es": "Diario no encontrado.",
    },
    "diary_edit_failed": {
        "ko": "수정에 실패했습니다.",
        "en": "Failed to update the diary.",
        "ja": "日記の更新に失敗しました。",
        "zh": "更新日记失败。",
        "es": "Error al actualizar el diario.",
    },
    # --- routes/comments.py ---
    "comment_create_error": {
        "ko": "댓글 생성 중 오류가 발생했습니다.",
        "en": "An error occurred while creating comments.",
        "ja": "コメントの作成中にエラーが発生しました。",
        "zh": "创建评论时发生错误。",
        "es": "Ocurrió un error al crear comentarios.",
    },
    "invalid_comment_mode": {
        "ko": "mode는 'new' 또는 'edit'만 가능합니다.",
        "en": "Mode must be 'new' or 'edit'.",
        "ja": "モードは'new'または'edit'のみ可能です。",
        "zh": "模式只能是'new'或'edit'。",
        "es": "El modo debe ser 'new' o 'edit'.",
    },
    # --- routes/agents.py ---
    "processing_error": {
        "ko": "처리 중 오류가 발생했습니다.",
        "en": "An error occurred during processing.",
        "ja": "処理中にエラーが発生しました。",
        "zh": "处理过程中发生错误。",
        "es": "Ocurrió un error durante el procesamiento.",
    },
    # --- routes/hospitals.py ---
    "hospital_search_fallback_name": {
        "ko": "주변 동물병원을 검색해보세요",
        "en": "Search for nearby veterinary hospitals",
        "ja": "近くの動物病院を検索してください",
        "zh": "搜索附近的宠物医院",
        "es": "Busca hospitales veterinarios cercanos",
    },
    "hospital_search_fallback_address": {
        "ko": "카카오맵에서 '동물병원'을 검색하세요",
        "en": "Search for 'veterinary hospital' on Kakao Maps",
        "ja": "カカオマップで「動物病院」を検索してください",
        "zh": "在Kakao地图上搜索'宠物医院'",
        "es": "Busca 'hospital veterinario' en Kakao Maps",
    },
    # --- main.py ---
    "forbidden": {
        "ko": "접근이 금지되었습니다.",
        "en": "Forbidden",
        "ja": "アクセスが禁止されています。",
        "zh": "禁止访问。",
        "es": "Acceso prohibido.",
    },
    # --- routes/social.py ---
    "entry_not_found": {
        "ko": "일기를 찾을 수 없습니다.",
        "en": "Diary entry not found.",
        "ja": "日記が見つかりません。",
        "zh": "未找到日记条目。",
        "es": "Entrada de diario no encontrada.",
    },
    "entry_not_owned": {
        "ko": "본인의 일기만 관리할 수 있습니다.",
        "en": "You can only manage your own diary entries.",
        "ja": "自分の日記のみ管理できます。",
        "zh": "只能管理自己的日记。",
        "es": "Solo puedes gestionar tus propias entradas de diario.",
    },
    "share_created": {
        "ko": "공유 링크가 생성되었습니다.",
        "en": "Share link created.",
        "ja": "共有リンクが作成されました。",
        "zh": "分享链接已创建。",
        "es": "Enlace compartido creado.",
    },
    "share_removed": {
        "ko": "공유가 해제되었습니다.",
        "en": "Sharing disabled.",
        "ja": "共有が解除されました。",
        "zh": "已取消分享。",
        "es": "Compartir desactivado.",
    },
    "shared_entry_not_found": {
        "ko": "공유된 일기를 찾을 수 없습니다.",
        "en": "Shared diary entry not found.",
        "ja": "共有された日記が見つかりません。",
        "zh": "未找到共享的日记条目。",
        "es": "Entrada de diario compartida no encontrada.",
    },
    "profile_not_public": {
        "ko": "공개 프로필이 아닙니다.",
        "en": "This profile is not public.",
        "ja": "このプロフィールは公開されていません。",
        "zh": "该个人资料未公开。",
        "es": "Este perfil no es público.",
    },
}


def get_message(key: str, lang: str = "ko") -> str:
    """Look up an i18n message by key and language code."""
    msg = MESSAGES.get(key, {})
    return msg.get(lang, msg.get("en", key))


def get_lang(request: Request) -> str:
    """FastAPI dependency: extract language from request.state (set by middleware)."""
    return getattr(request.state, "lang", "ko")
