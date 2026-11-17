import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import random

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp: str) -> bool:
    smtp_email = os.getenv("SMTP_EMAIL", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_email or not smtp_password:
        print("\n" + "="*50)
        print("[DEV MODE] Activation Email Intercepted")
        print(f"To: {to_email}")
        print(f"OTP Code: {otp}")
        print("="*50 + "\n")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_email
        msg['To'] = to_email
        msg['Subject'] = "FinSight - Your Account Activation Code"
        body = f"Welcome to FinSight!\n\nYour 6-digit account activation code is: {otp}\n\nThis code will expire in 24 hours."
        msg.attach(MIMEText(body, 'plain'))
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False

def send_password_reset_email(to_email: str, token: str) -> bool:
    smtp_email = os.getenv("SMTP_EMAIL", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    
    # NEW LOGIC: Use live URL if available, otherwise fallback to localhost
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    if not smtp_email or not smtp_password:
        print("\n" + "="*50)
        print("[DEV MODE] Password Reset Intercepted")
        print(f"To: {to_email}")
        print(f"Reset Link: {reset_link}")
        print("="*50 + "\n")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_email
        msg['To'] = to_email
        msg['Subject'] = "FinSight - Password Reset Request"
        body = f"You requested a password reset for your FinSight account.\n\nClick the link below to securely set a new password:\n{reset_link}\n\nThis link will expire in 15 minutes. If you did not request this, please ignore this email."
        msg.attach(MIMEText(body, 'plain'))
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False
