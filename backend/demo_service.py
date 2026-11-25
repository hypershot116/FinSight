import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import auth, models

DEMO_EMAIL = "demo@finsight.app"

SAMPLE_TXS = [
    ("Monthly Salary", 4200.0, "Salary", "INCOME", 32),
    ("Apartment Rent", 1350.0, "Housing", "EXPENSE", 30),
    ("Whole Foods Groceries", 142.5, "Food", "EXPENSE", 27),
    ("Metro & Uber Rides", 64.0, "Transport", "EXPENSE", 24),
    ("Dividend Payout", 185.0, "Investment", "INCOME", 20),
    ("Electric & Fiber Internet", 118.0, "Housing", "EXPENSE", 18),
    ("Weekend Dining Out", 89.0, "Food", "EXPENSE", 14),
    ("Freelance UI Audit", 650.0, "Other", "INCOME", 10),
    ("Cloud & Software Tools", 48.0, "General", "EXPENSE", 6),
    ("Weekly Groceries", 112.0, "Food", "EXPENSE", 2),
]

def ensure_demo_user_and_seed(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
    if not user:
        user = models.User(
            name="Demo Reviewer",
            email=DEMO_EMAIL,
            password_hash=auth.get_password_hash(secrets.token_urlsafe(32)),
            location="Remote",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    if db.query(models.Transaction).filter(models.Transaction.user_id == user.id).count() < 5:
        from sqlalchemy import text
        now = datetime.utcnow()
        for title, amt, cat, tx_type, days_ago in SAMPLE_TXS:
            db.execute(
                text(
                    "INSERT INTO transactions (user_id, amount, title, category, type, date) "
                    "VALUES (:user_id, :amount, :title, :category, CAST(:tx_type AS transactiontype), :tx_date)"
                ),
                {
                    "user_id": user.id,
                    "amount": amt,
                    "title": title,
                    "category": cat,
                    "tx_type": tx_type,
                    "tx_date": now - timedelta(days=days_ago),
                },
            )
        db.commit()
    if db.query(models.Budget).filter(models.Budget.user_id == user.id).count() == 0:
        for cat, lim in [("Food", 450.0), ("Housing", 1600.0), ("Transport", 150.0), ("General", 200.0)]:
            db.add(models.Budget(user_id=user.id, category=cat, monthly_limit=lim))
        db.commit()
    return user

def generate_rule_based_insight(transactions) -> str:
    inc = sum(t.amount for t in transactions if "INCOME" in (t.type or "").upper())
    exp = sum(t.amount for t in transactions if "INCOME" not in (t.type or "").upper())
    by_cat = {}
    for t in transactions:
        if "INCOME" not in (t.type or "").upper():
            by_cat[t.category] = by_cat.get(t.category, 0.0) + t.amount
    top_cat, top_val = max(by_cat.items(), key=lambda x: x[1], default=("General", 0.0))
    rate = ((inc - exp) / inc * 100) if inc > 0 else 0.0
    share = (top_val / exp * 100) if exp > 0 else 0.0
    return (
        f"You logged ${inc:,.2f} in income against ${exp:,.2f} in expenses, leaving a {rate:.1f}% savings rate. "
        f"Your biggest spending drain is {top_cat} at ${top_val:,.2f} ({share:.0f}% of total outflow). "
        f"Trimming {top_cat} by 15% would save ${(top_val * 0.15):,.2f} next cycle—add a free Groq key above for deep LLM coaching."
    )
