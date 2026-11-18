import os
import requests
import random

def generate_otp():
    """Generates a 6-digit random OTP."""
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp: str):
    api_key = os.getenv("RESEND_API_KEY")
    
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "from": "FinSight <onboarding@resend.dev>",
            "to": [to_email],
            "subject": "Your FinSight Verification Code",
            "html": f"<p>Your verification code is: <strong>{otp}</strong></p>"
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Email delivery failed: {response.text}")
    return True