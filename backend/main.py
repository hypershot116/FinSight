import hashlib
import os
import re
from datetime import datetime, timedelta
from typing import List, Optional

import requests
from fastapi import Request, Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import demo_service
import email_service
import finance_routes
import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)
finance_routes.ensure_finance_schema(engine)

app = FastAPI(title="FinSight API")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(finance_routes.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://finsight-pink-zeta.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    location: Optional[str] = None


class OTPVerifyRequest(BaseModel):
    email: str
    otp_code: str


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    is_admin: bool


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetTokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _validate_password_strength(password: str):
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password cannot exceed 72 bytes (approx. 72 ASCII characters).",
        )
    if (
        len(password) < 8
        or not re.search(r"[A-Z]", password)
        or not re.search(r"[0-9]", password)
        or not re.search(r"[^A-Za-z0-9]", password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
        )


def _password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


def _validate_reset_token(token: str, db: Session) -> models.User:
    try:
        decoded = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if decoded.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Invalid reset link.")
        email = decoded.get("sub")
        token_ph = decoded.get("ph")
        if not email or not token_ph:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired reset link. Please request a new one.",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    if _password_fingerprint(user.password_hash) != token_ph:
        raise HTTPException(
            status_code=400,
            detail="This reset link has already been used or is no longer valid.",
        )

    return user


def cleanup_ghost_accounts(db: Session):
    threshold = datetime.utcnow() - timedelta(hours=24)
    db.query(models.User).filter(
        models.User.is_active == False,
        models.User.otp_code.isnot(None),
        models.User.created_at < threshold,
    ).delete()
    db.commit()


# --- ADMIN DEPENDENCIES ---
def get_current_admin(current_user: models.User = Depends(auth.get_current_user)):
    if not (current_user.is_admin or current_user.is_master_admin):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


def get_current_master_admin(current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.is_master_admin:
        raise HTTPException(status_code=403, detail="Master Admin privileges required")
    return current_user


# --- AUTH & REGISTRATION ---
@app.post("/register")
def register_user(user: RegisterRequest, db: Session = Depends(get_db)):
    _validate_password_strength(user.password)
    cleanup_ghost_accounts(db)

    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        if existing_user.is_active or existing_user.otp_code is None:
            raise HTTPException(status_code=400, detail="Email already registered")
        db.delete(existing_user)
        db.commit()

    hashed_password = auth.get_password_hash(user.password)
    otp = email_service.generate_otp()

    new_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        location=user.location,
        is_active=False,
        otp_code=otp,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    email_service.send_otp_email(to_email=user.email, otp=otp)
    return {"message": "OTP sent successfully", "email": user.email}


@app.post("/verify-otp")
def verify_otp(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter(
            models.User.email == payload.email,
            models.User.is_active == False,
            models.User.otp_code.isnot(None),
        )
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found or already active")

    if user.created_at < datetime.utcnow() - timedelta(hours=24):
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please register again.")

    if user.otp_code != payload.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    user.is_active = True
    user.otp_code = None
    db.commit()
    return {"message": "Account activated successfully"}


@app.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not activated.",
        )

    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# --- TRANSACTIONS ---
@app.post("/transactions", response_model=schemas.TransactionResponse)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_transaction = models.Transaction(**{k: v for k, v in transaction.model_dump().items() if v is not None}, user_id=current_user.id)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@app.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.date.desc())
        .all()
    )


@app.put("/transactions/{transaction_id}", response_model=schemas.TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_tx = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == current_user.id,
        )
        .first()
    )
    if not db_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for key, value in transaction.model_dump().items():
        setattr(db_tx, key, value) if not (key == 'date' and value is None) else None

    db.commit()
    db.refresh(db_tx)
    return db_tx


@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_tx = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == current_user.id,
        )
        .first()
    )
    if not db_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(db_tx)
    db.commit()
    return {"message": "Transaction deleted"}


# --- ADMIN ROUTES ---
@app.get("/admin/users")
def get_all_users(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "is_active": bool(u.is_active),
            "is_admin": bool(u.is_admin),
            "is_master_admin": bool(u.is_master_admin),
            "has_pending_otp": u.otp_code is not None,
            "created_at": u.created_at,
        }
        for u in users
    ]


@app.put("/admin/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    if user.is_master_admin or user.email == demo_service.DEMO_EMAIL:
        raise HTTPException(status_code=403, detail="Master Admin accounts cannot be modified.")
    if user.is_admin and not admin.is_master_admin:
        raise HTTPException(
            status_code=403,
            detail="Only a Master Admin can modify another Admin's status.",
        )

    user.is_active = payload.is_active
    if payload.is_active:
        user.otp_code = None
    db.commit()
    return {"message": "Status updated", "is_active": user.is_active}


@app.put("/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    master_admin: models.User = Depends(get_current_master_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == master_admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")
    if user.is_master_admin or user.email == demo_service.DEMO_EMAIL:
        raise HTTPException(status_code=403, detail="Master Admin role cannot be modified.")
    if payload.is_admin and not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User must be active before promoting to Admin.",
        )

    user.is_admin = payload.is_admin
    db.commit()
    action = "promoted to Admin" if payload.is_admin else "demoted to User"
    return {"message": f"{user.email} has been {action}.", "is_admin": user.is_admin}


# --- AI INSIGHTS (GROQ PRIMARY + OPTIONAL BYOK) ---
def _call_groq(api_key: str, prompt: str) -> str:
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-oss-20b",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens": 250,
        },
        timeout=20,
    )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=400,
            detail="Invalid Groq API key. Please check your key (starts with gsk_) and try again.",
        )
    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Groq rate limit reached. Wait a few seconds and try again.",
        )
    if not resp.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Groq API error ({resp.status_code}): {resp.text[:200]}",
        )
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def _call_gemini(api_key: str, prompt: str) -> str:
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=20,
    )
    if resp.status_code in (400, 401, 403):
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Gemini API key. Consider using a free Groq API key (gsk_...) instead.",
        )
    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Google Gemini free-tier quota exceeded (429). Switch to a free Groq API key for reliable access.",
        )
    if not resp.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error ({resp.status_code}): {resp.text[:200]}",
        )
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


@app.get("/insights")
def get_financial_insights(
    x_ai_key: Optional[str] = Header(default=None, alias="X-AI-Key"),
    x_ai_provider: Optional[str] = Header(default=None, alias="X-AI-Provider"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.date.desc())
        .limit(50)
        .all()
    )
    if len(transactions) < 3:
        raise HTTPException(
            status_code=400,
            detail="Add at least 3 transactions to unlock AI insights.",
        )

    data_str = "\n".join(
        [
            f"{t.date.strftime('%Y-%m-%d')}: {t.type} - {t.title} - ${t.amount} ({t.category})"
            for t in transactions
        ]
    )

    prompt = f"""
You are a blunt, expert financial analyst. Analyze this transaction history.
Provide a short, punchy 3-sentence financial insight.
Identify their biggest spending drain and suggest one specific, actionable improvement.
Do not use any markdown formatting or bullet points. Just standard text.

Transaction History:
{data_str}
"""

    user_key = (x_ai_key or "").strip()
    if user_key:
        provider = (x_ai_provider or "").strip().lower()
        if user_key.startswith("gsk_") or provider == "groq":
            insight = _call_groq(user_key, prompt)
            return {"insight": insight, "provider": "Groq (Personal Key)"}
        if user_key.startswith("AIza") or provider == "gemini":
            insight = _call_gemini(user_key, prompt)
            return {"insight": insight, "provider": "Gemini (Personal Key)"}
        raise HTTPException(
            status_code=400,
            detail="Unrecognized API key format. Paste a Groq key (gsk_...) or Gemini key (AIza...).",
        )

    server_groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if server_groq_key:
        insight = _call_groq(server_groq_key, prompt)
        return {"insight": insight, "provider": "Groq"}

    server_gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if server_gemini_key:
        insight = _call_gemini(server_gemini_key, prompt)
        return {"insight": insight, "provider": "Gemini"}

    return {
        "insight": demo_service.generate_rule_based_insight(transactions),
        "provider": "Smart Engine (Add Groq Key for LLM)",
    }


# --- PASSWORD RECOVERY ---
@app.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if user and user.is_active:
        expire = datetime.utcnow() + timedelta(minutes=15)
        reset_token = jwt.encode(
            {
                "sub": user.email,
                "type": "reset",
                "ph": _password_fingerprint(user.password_hash),
                "exp": expire,
            },
            auth.SECRET_KEY,
            algorithm=auth.ALGORITHM,
        )
        email_service.send_password_reset_email(user.email, reset_token)

    return {"message": "If that email is registered, a password reset link has been sent."}


@app.post("/verify-reset-token")
def verify_reset_token(payload: VerifyResetTokenRequest, db: Session = Depends(get_db)):
    _validate_reset_token(payload.token, db)
    return {"valid": True}


@app.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    _validate_password_strength(payload.new_password)
    user = _validate_reset_token(payload.token, db)
    user.password_hash = auth.get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password has been successfully reset."}


@app.get("/status")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/demo-login", response_model=schemas.Token)
@limiter.limit("5/minute")
def demo_login(request: Request, db: Session = Depends(get_db)):
    try:
        user = demo_service.ensure_demo_user_and_seed(db)
        return {"access_token": auth.create_access_token(data={"sub": user.email}), "token_type": "bearer"}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Demo setup failed: {exc}")
class AIParseRequest(BaseModel):
    text: str

import ai_engine
from fastapi import Query

@app.post("/insights/parse")
def parse_natural_language_tx(
    payload: AIParseRequest,
    x_ai_key: Optional[str] = Header(default=None, alias="X-AI-Key"),
    x_ai_provider: Optional[str] = Header(default="groq", alias="X-AI-Provider"),
    current_user: models.User = Depends(auth.get_current_user)
):
    key = (x_ai_key or "").strip()
    if not key: raise HTTPException(status_code=400, detail="API Key required.")
    prompt = f"Extract transaction from: '{payload.text}'. Today is {datetime.utcnow().strftime('%Y-%m-%d')}. Respond ONLY with a JSON object containing keys: title (string), amount (number), category (Food, Transport, Housing, General, Salary, Investment, Other), type (INCOME or EXPENSE), date (YYYY-MM-DD)."
    try:
        res = ai_engine.call_llm(x_ai_provider, key, prompt, json_mode=True)
        res = res.replace("```json", "").replace("```", "").strip()
        import json
        return schemas.TransactionCreate(**json.loads(res))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/insights")
def get_ai_insights(
    month: str = Query(..., description="YYYY-MM"),
    x_ai_key: Optional[str] = Header(default=None, alias="X-AI-Key"),
    x_ai_provider: Optional[str] = Header(default="groq", alias="X-AI-Provider"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    key = (x_ai_key or "").strip()
    # Filter only for the selected month
    start_date = f"{month}-01 00:00:00"
    end_date = f"{month}-31 23:59:59"
    txs = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.date >= start_date,
        models.Transaction.date <= end_date
    ).all()
    
    if not key:
        return {"insight": demo_service.generate_rule_based_insight(txs, month), "provider": "Rule-Based"}
        
    if len(txs) < 3:
        return {"insight": f"Not enough transactions in {month} to generate a meaningful analysis.", "provider": x_ai_provider.capitalize()}
        
    tx_data = [{"amount": t.amount, "category": t.category, "type": t.type, "title": t.title} for t in txs]
    prompt = f"You are a fast, precise financial advisor. Analyze ONLY this specific month ({month}) based on this data: {tx_data}. Give exactly 3 short sentences of specific, actionable advice about this month's spending and income flow. Be direct."
    
    try:
        res = ai_engine.call_llm(x_ai_provider, key, prompt, json_mode=False)
        return {"insight": res.strip(), "provider": x_ai_provider.capitalize()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
