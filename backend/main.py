import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import engine, get_db
from google import genai

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fiscaly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post("/transactions", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_transaction = models.Transaction(**transaction.model_dump(), user_id=current_user.id)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).order_by(models.Transaction.date.desc()).all()

# --- Gemini AI Integration (Updated SDK) ---
@app.get("/insights")
def get_financial_insights(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).all()
    if len(transactions) < 3:
        raise HTTPException(status_code=400, detail="Add at least 3 transactions to unlock AI insights.")
        
    data_str = "\n".join([f"{t.date.strftime('%Y-%m-%d')}: {t.type} - {t.title} - ${t.amount} ({t.category})" for t in transactions])
    
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
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return {"insight": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
