from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    currency: str = "USD"
    is_admin: bool = False
    is_master_admin: bool = False

    class Config:
        from_attributes = True


class CurrencyUpdate(BaseModel):
    currency: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TransactionCreate(BaseModel):
    amount: float
    title: str
    category: str
    type: str
    date: Optional[datetime] = None


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    amount: float
    title: str
    category: str
    type: str
    date: datetime

    class Config:
        from_attributes = True


class BulkTransactionCreate(BaseModel):
    transactions: List[TransactionCreate] = Field(..., max_length=500)


class BudgetUpsert(BaseModel):
    category: str
    monthly_limit: float


class BudgetResponse(BaseModel):
    id: int
    category: str
    monthly_limit: float

    class Config:
        from_attributes = True
