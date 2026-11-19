import os
import secrets
from pathlib import Path
import requests


def _load_local_env():
    """Loads backend/.env locally without overriding production environment variables."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_local_env()


def generate_otp() -> str:
    """Generates a cryptographically secure 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)


def _send_brevo_email(to_email: str, subject: str, html_content: str) -> bool:
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "blackaudition01@gmail.com")

    if not api_key:
        raise RuntimeError("BREVO_API_KEY is not set in environment variables.")

    response = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        json={
            "sender": {"name": "FinSight", "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        },
        timeout=15,
    )

    if response.status_code not in (200, 201, 202):
        raise Exception(f"Email delivery failed ({response.status_code}): {response.text}")
    return True


def send_otp_email(to_email: str, otp: str) -> bool:
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>Verify your FinSight account</h2>
      <p>Use the 6-digit code below to activate your account:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{otp}</p>
      <p style="color: #666; font-size: 13px;">This code expires in 24 hours. If you did not sign up, you can ignore this email.</p>
    </div>
    """
    return _send_brevo_email(
        to_email=to_email,
        subject="Your FinSight Verification Code",
        html_content=html_content,
    )


def send_password_reset_email(to_email: str, token: str) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>Reset your FinSight password</h2>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <p style="margin: 24px 0;">
        <a href="{reset_link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; word-break: break-all; color: #2563eb;">{reset_link}</p>
      <p style="color: #666; font-size: 13px;">This link expires in 15 minutes. If you did not request a reset, ignore this email.</p>
    </div>
    """
    return _send_brevo_email(
        to_email=to_email,
        subject="FinSight - Password Reset Request",
        html_content=html_content,
    )
