import secrets
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
import auth, models

DEMO_EMAIL = "demo@finsight.app"

def ensure_demo_user_and_seed(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
    if not user:
        user = models.User(name="Demo Reviewer", email=DEMO_EMAIL, password_hash=auth.get_password_hash(secrets.token_urlsafe(32)), location="Remote", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # Generate 1 full year of data (12 months) if empty
    if db.query(models.Transaction).filter(models.Transaction.user_id == user.id).count() < 12:
        for month in range(1, 13):
            # Fixed Income & Housing
            db.execute(text("INSERT INTO transactions (user_id, amount, title, category, type, date) VALUES (:u, :a, :t, :c, CAST('INCOME' AS transactiontype), :d)"), {"u": user.id, "a": 4200.0, "t": "Monthly Salary", "c": "Salary", "d": f"2026-{month:02d}-01 10:00:00"})
            db.execute(text("INSERT INTO transactions (user_id, amount, title, category, type, date) VALUES (:u, :a, :t, :c, CAST('EXPENSE' AS transactiontype), :d)"), {"u": user.id, "a": 1350.0, "t": "Apartment Rent", "c": "Housing", "d": f"2026-{month:02d}-02 10:00:00"})
            # Random spending
            cats = ["Food", "Transport", "General"]
            for _ in range(5):
                day = random.randint(3, 28)
                c = random.choice(cats)
                a = round(random.uniform(15.0, 120.0), 2)
                db.execute(text("INSERT INTO transactions (user_id, amount, title, category, type, date) VALUES (:u, :a, :t, :c, CAST('EXPENSE' AS transactiontype), :d)"), {"u": user.id, "a": a, "t": f"Misc {c}", "c": c, "d": f"2026-{month:02d}-{day:02d} 14:00:00"})
        db.commit()
        
    if db.query(models.Budget).filter(models.Budget.user_id == user.id).count() == 0:
        for cat, lim in [("Food", 450.0), ("Housing", 1600.0), ("Transport", 150.0), ("General", 200.0)]:
            db.add(models.Budget(user_id=user.id, category=cat, monthly_limit=lim))
        db.commit()
    return user

def generate_rule_based_insight(transactions, month: str) -> str:
    inc = sum(t.amount for t in transactions if "INCOME" in (t.type or "").upper())
    exp = sum(t.amount for t in transactions if "INCOME" not in (t.type or "").upper())
    rate = ((inc - exp) / inc * 100) if inc > 0 else 0.0
    return f"In {month}, you logged ${inc:,.2f} in income and ${exp:,.2f} in expenses (Savings rate: {rate:.1f}%). Add an AI key above for intelligent, model-driven monthly analysis."
