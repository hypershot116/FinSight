import hashlib
import os
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from google import genai
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import email_service
import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinSight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# --- ADMIN DEPENDENCY ---
def get_current_admin(current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
    db_transaction = models.Transaction(**transaction.model_dump(), user_id=current_user.id)
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
        setattr(db_tx, key, value)

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
            "is_active": u.is_active,
            "is_admin": u.is_admin,
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
        raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account.")
    user.is_active = payload.is_active
    db.commit()
    return {"message": "Status updated"}


# --- AI INSIGHTS ---
@app.get("/insights")
def get_financial_insights(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
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
    try:
        client = genai.Client()
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return {"insight": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- PASSWORD RECOVERY ---
@app.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
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
