from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TransactionCreate(BaseModel):
    amount: float
    title: str
    category: str
    type: str # "income" or "expense"

class TransactionResponse(TransactionCreate):
    id: int
    user_id: int
    date: datetime
    class Config:
        from_attributes = True
