from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    location = Column(String, nullable=True)
    currency = Column(String, default="USD", nullable=False)
    is_active = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_master_admin = Column(Boolean, default=False)
    otp_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    transactions = relationship("Transaction", back_populates="owner")
    budgets = relationship("Budget", back_populates="owner")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    type = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "category", name="uq_user_category_budget"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False)
    monthly_limit = Column(Float, nullable=False)
    owner = relationship("User", back_populates="budgets")
