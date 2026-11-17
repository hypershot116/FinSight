import auth, models
from database import SessionLocal

def seed_admin():
    db = SessionLocal()
    admin_email = "admin@example.com"
    
    existing_user = db.query(models.User).filter(models.User.email == admin_email).first()
    
    if not existing_user:
        print("Creating Admin account...")
        hashed_pw = auth.get_password_hash("AdminPass123!")
        new_user = models.User(
            name="System Admin",
            email=admin_email,
            password_hash=hashed_pw,
            location="HQ",
            is_active=True,
            is_admin=True,
            otp_code=None
        )
        db.add(new_user)
        db.commit()
        print("\nSUCCESS! Admin account created.")
    else:
        existing_user.is_admin = True
        existing_user.is_active = True
        db.commit()
        print("\nAdmin account updated and verified.")
        
    print("Email:    admin@example.com")
    print("Password: AdminPass123!\n")
    db.close()

if __name__ == "__main__":
    seed_admin()
