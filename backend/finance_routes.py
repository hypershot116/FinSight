from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
import auth, models, schemas
from database import get_db

router = APIRouter(tags=["Finance"])
ALLOWED_CURRENCIES = {"USD", "BDT", "EUR", "GBP"}


def ensure_finance_schema(engine):
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        if "currency" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN currency VARCHAR DEFAULT 'USD'"))
                conn.execute(text("UPDATE users SET currency = 'USD' WHERE currency IS NULL"))


@router.put("/me/currency")
def update_currency(
    payload: schemas.CurrencyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    code = payload.currency.strip().upper()
    if code not in ALLOWED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency.")
    current_user.currency = code
    db.commit()
    return {"currency": code}


@router.get("/budgets", response_model=List[schemas.BudgetResponse])
def list_budgets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Budget).filter(models.Budget.user_id == current_user.id).all()


@router.put("/budgets", response_model=schemas.BudgetResponse)
def upsert_budget(
    payload: schemas.BudgetUpsert,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.monthly_limit <= 0:
        raise HTTPException(status_code=400, detail="Monthly limit must be positive.")
    b = db.query(models.Budget).filter(
        models.Budget.user_id == current_user.id, models.Budget.category == payload.category
    ).first()
    if b:
        b.monthly_limit = payload.monthly_limit
    else:
        b = models.Budget(user_id=current_user.id, category=payload.category, monthly_limit=payload.monthly_limit)
        db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    b = db.query(models.Budget).filter(
        models.Budget.id == budget_id, models.Budget.user_id == current_user.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found.")
    db.delete(b)
    db.commit()
    return {"message": "Budget deleted"}


@router.post("/transactions/bulk")
def bulk_create_transactions(
    payload: schemas.BulkTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    for item in payload.transactions:
        data = {k: v for k, v in item.model_dump().items() if v is not None}
        db.add(models.Transaction(**data, user_id=current_user.id))
    db.commit()
    return {"imported": len(payload.transactions)}
