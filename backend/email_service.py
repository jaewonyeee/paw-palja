"""
Email notification service for Paw-Palja.
Sends Animal Crossing-style cute reminder emails using stdlib smtplib.
"""
import os
import logging
import smtplib
from html import escape as html_escape
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("pawpalja.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def _is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _build_html(dog_name: str, nickname: str, recent_diary_data: dict | None, lang: str) -> str:
    """Build an Animal Crossing-style HTML email template."""
    is_ko = lang == "ko"
    safe_dog = html_escape(dog_name)
    safe_nick = html_escape(nickname)

    if is_ko:
        greeting = f"{safe_dog}가 오늘 하루를 기다리고 있어요!"
        sub_greeting = f"안녕하세요, {safe_nick}님!"
        cta_text = "지금 일기 쓰러 가기"
        footer_text = "포팔자에서 보낸 알림이에요"
    else:
        greeting = f"{safe_dog} is waiting for today's story!"
        sub_greeting = f"Hello, {safe_nick}!"
        cta_text = "Write today's diary"
        footer_text = "Sent from Paw-Palja"

    recent_section = ""
    if recent_diary_data:
        diary = recent_diary_data.get("diary", {})
        title = html_escape(diary.get("title_ko") or diary.get("title_en") or diary.get("title", ""))
        if title:
            label = "지난 일기" if is_ko else "Last diary"
            recent_section = f"""
            <div style="background:#FFF8F0;border-radius:12px;padding:14px 18px;margin:16px 0;border-left:4px solid #F0A04B;">
              <p style="margin:0;font-size:13px;color:#8B6914;font-weight:600;">{label}</p>
              <p style="margin:6px 0 0;font-size:14px;color:#6B5B3E;">{title}</p>
            </div>
            """

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:white;border-radius:20px;padding:32px 28px;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:2px solid #F5E6D3;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">🐾</div>
        <h1 style="margin:0;font-size:20px;color:#6C5CE7;font-weight:800;">Paw-Palja</h1>
      </div>

      <!-- Greeting -->
      <div style="background:linear-gradient(135deg,#6C5CE7,#a29bfe);border-radius:16px;padding:24px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;font-size:16px;color:rgba(255,255,255,0.85);font-weight:500;">{sub_greeting}</p>
        <h2 style="margin:8px 0 0;font-size:20px;color:white;font-weight:800;">{greeting}</h2>
      </div>

      {recent_section}

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="https://pawpalja.com/home" style="display:inline-block;background:linear-gradient(135deg,#F0A04B,#f5b76c);color:white;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:16px;font-weight:700;box-shadow:0 4px 12px rgba(240,160,75,0.3);">
          {cta_text}
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding-top:16px;border-top:1.5px dashed #F5E6D3;">
        <p style="margin:0;font-size:12px;color:#C8A882;">{footer_text} 🐕</p>
      </div>
    </div>
  </div>
</body>
</html>"""


def send_diary_reminder_email(
    to_email: str,
    dog_name: str,
    nickname: str,
    recent_diary_data: dict | None = None,
    lang: str = "ko",
) -> bool:
    """Send a diary reminder email. Returns True on success."""
    if not _is_configured():
        logger.debug("Email not configured, skipping send")
        return False

    try:
        is_ko = lang == "ko"
        subject = f"🐾 {dog_name}가 기다리고 있어요!" if is_ko else f"🐾 {dog_name} is waiting for you!"

        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = subject

        html = _build_html(dog_name, nickname, recent_diary_data, lang)
        msg.attach(MIMEText(html, "html", "utf-8"))

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())

        logger.info(f"Reminder email sent to {to_email} for {dog_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}", exc_info=True)
        return False
