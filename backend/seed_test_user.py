import auth, models
from database import SessionLocal

def seed_user():
    db = SessionLocal()
    test_email = "test@example.com"
    
    # Check if test user already exists
    existing_user = db.query(models.User).filter(models.User.email == test_email).first()
    
    if not existing_user:
        print("Creating local test credentials...")
        hashed_pw = auth.get_password_hash("TestPass123!")
        new_user = models.User(
            name="Developer Test",
            email=test_email,
            password_hash=hashed_pw,
            location="Localhost",
            is_active=True,  # Bypasses the OTP requirement
            otp_code=None
        )
        db.add(new_user)
        db.commit()
        print("\nSUCCESS! You can now log in with:")
        print("Email:    test@example.com")
        print("Password: TestPass123!\n")
    else:
        # If it exists but is inactive, activate it
        if not existing_user.is_active:
            existing_user.is_active = True
            db.commit()
            print("Activated existing test account.")
        print("\nTest account is ready to use.")
        print("Email:    test@example.com")
        print("Password: TestPass123!\n")
        
    db.close()

if __name__ == "__main__":
    seed_user()
