"""Environment-driven email delivery service for magic links and password recovery.

Supports Resend, SMTP, and server console logging in development.
Credentials and tokens are dispatched through email or logged server-side;
they are NEVER included in unauthenticated client HTTP responses.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional
import httpx
from strata_api.config import settings

logger = logging.getLogger("strata.email")

# In-memory server-side dispatch log (accessible only via server-side/admin flows, never in client HTTP responses)
_dispatched_emails: List[Dict[str, Any]] = []


class EmailService:
    """Manages email dispatch with pluggable providers."""

    @staticmethod
    def send_magic_link(email: str, token: str) -> None:
        """Dispatch a passwordless magic sign-in link."""
        link = f"{settings.APP_BASE_URL}/login?magic_token={token}"
        subject = f"Your Magic Sign-In Link for {settings.PROJECT_NAME}"
        body_text = f"Click the link below to sign in to your Strata workspace:\n\n{link}\n\nThis link will expire in 15 minutes."
        body_html = f"""
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px;">
            <h2>Sign in to {settings.PROJECT_NAME}</h2>
            <p>Click the link below to authenticate securely without a password:</p>
            <p style="margin: 25px 0;">
                <a href="{link}" style="background-color: #0061FE; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Sign in to Strata
                </a>
            </p>
            <p style="color: #666; font-size: 12px;">This link will expire in 15 minutes. If you did not request this link, you can safely ignore this email.</p>
        </div>
        """
        EmailService._dispatch(
            to_email=email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            token=token,
            token_type="magic_link",
            link=link,
        )

    @staticmethod
    def send_password_reset(email: str, token: str) -> None:
        """Dispatch a password recovery link."""
        link = f"{settings.APP_BASE_URL}/reset-password?token={token}"
        subject = f"Reset Your {settings.PROJECT_NAME} Password"
        body_text = f"Click the link below to reset your Strata password:\n\n{link}\n\nThis link will expire in 30 minutes."
        body_html = f"""
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px;">
            <h2>Reset your password</h2>
            <p>We received a request to reset your {settings.PROJECT_NAME} account password:</p>
            <p style="margin: 25px 0;">
                <a href="{link}" style="background-color: #0061FE; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Reset Password
                </a>
            </p>
            <p style="color: #666; font-size: 12px;">This link will expire in 30 minutes. If you did not request this change, you can safely ignore this email.</p>
        </div>
        """
        EmailService._dispatch(
            to_email=email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            token=token,
            token_type="reset_password",
            link=link,
        )

    @staticmethod
    def _dispatch(
        to_email: str,
        subject: str,
        body_text: str,
        body_html: str,
        token: str,
        token_type: str,
        link: str,
    ) -> None:
        """Send email via configured provider or log to console in dev mode."""
        record = {
            "to_email": to_email,
            "subject": subject,
            "token": token,
            "token_type": token_type,
            "link": link,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
        }
        _dispatched_emails.append(record)

        provider = settings.EMAIL_PROVIDER.lower()

        # Resend API Provider
        if provider == "resend" and settings.RESEND_API_KEY:
            try:
                resp = httpx.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                    json={
                        "from": settings.SMTP_FROM,
                        "to": [to_email],
                        "subject": subject,
                        "text": body_text,
                        "html": body_html,
                    },
                    timeout=5.0,
                )
                if resp.status_code >= 400:
                    logger.error(f"Resend dispatch error: {resp.text}")
                return
            except Exception as e:
                logger.error(f"Failed to dispatch email via Resend: {e}")

        # SMTP Provider
        if provider == "smtp" and settings.SMTP_HOST:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = settings.SMTP_FROM
                msg["To"] = to_email
                msg.attach(MIMEText(body_text, "plain"))
                msg.attach(MIMEText(body_html, "html"))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
                return
            except Exception as e:
                logger.error(f"Failed to dispatch email via SMTP: {e}")

        # Default Console/Logger fallback (dev mode)
        print(f"\n[EMAIL DISPATCH] To: {to_email} | Subject: {subject} | Action Link: {link}\n")
        logger.info(f"[EMAIL DISPATCH] Dispatched {token_type} to {to_email}: {link}")


def get_latest_token_for_email(email: str, token_type: Optional[str] = None) -> Optional[str]:
    """Retrieve the latest dispatched token for an email (for testing/server-side verification)."""
    clean_email = email.strip().lower()
    for rec in reversed(_dispatched_emails):
        if rec["to_email"].lower() == clean_email:
            if token_type is None or rec.get("token_type") == token_type:
                return rec.get("token")
    return None


def clear_dispatched_emails() -> None:
    """Clear in-memory email dispatch logs."""
    _dispatched_emails.clear()
