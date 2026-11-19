import getpass
import re
import auth
import models
from database import SessionLocal, engine


def validate_password(password: str):
    if len(password.encode("utf-8")) > 72:
        return "Password cannot exceed 72 bytes."
    if (
        len(password) < 8
        or not re.search(r"[A-Z]", password)
        or not re.search(r"[0-9]", password)
        or not re.search(r"[^A-Za-z0-9]", password)
    ):
        return "Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character."
    return None


def seed_master_admin():
    print(f"Target DB: {engine.dialect.name} ({engine.url.host or engine.url.database})")
    email = input("Master Admin Email: ").strip().lower()
    if not email or "@" not in email:
        print("Invalid email. Aborted.")
        return

    db = SessionLocal()
    try:
        existing_user = db.query(models.User).filter(models.User.email == email).first()

        if existing_user:
            print(f"Account already exists for {email}.")
            choice = input("Promote this existing account to Master Admin? (y/n): ").strip().lower()
            if choice != "y":
                print("Aborted.")
                return
            existing_user.is_active = True
            existing_user.is_admin = True
            existing_user.is_master_admin = True
            existing_user.otp_code = None

            reset_pw = input("Reset password for this account too? (y/n): ").strip().lower()
            if reset_pw == "y":
                while True:
                    pw = getpass.getpass("New Password: ")
                    err = validate_password(pw)
                    if err:
                        print(f"Error: {err}")
                        continue
                    confirm = getpass.getpass("Confirm Password: ")
                    if pw != confirm:
                        print("Passwords do not match. Try again.")
                        continue
                    existing_user.password_hash = auth.get_password_hash(pw)
                    break

            db.commit()
            print(f"\nSUCCESS: {email} is now a Master Admin.")
        else:
            name = input("Master Admin Name [Master Admin]: ").strip() or "Master Admin"
            while True:
                pw = getpass.getpass("Master Admin Password: ")
                err = validate_password(pw)
                if err:
                    print(f"Error: {err}")
                    continue
                confirm = getpass.getpass("Confirm Password: ")
                if pw != confirm:
                    print("Passwords do not match. Try again.")
                    continue
                break

            new_user = models.User(
                name=name,
                email=email,
                password_hash=auth.get_password_hash(pw),
                location="HQ",
                is_active=True,
                is_admin=True,
                is_master_admin=True,
                otp_code=None,
            )
            db.add(new_user)
            db.commit()
            print(f"\nSUCCESS: Master Admin account created for {email}.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_master_admin()
