# FinSight — Full-Stack Personal Finance & AI Analytics Platform

**Live Application:** [https://finsight-pink-zeta.vercel.app](https://finsight-pink-zeta.vercel.app)

FinSight is a full-stack personal finance tracker featuring end-to-end authentication, transactional email verification, single-use password recovery, hierarchical Role-Based Access Control (RBAC), and AI-powered spending analysis.

---

## Architecture & Tech Stack

| Layer | Technology | Hosting |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts | Vercel |
| **Backend API** | Python, FastAPI, SQLAlchemy ORM, Pydantic | Render |
| **Database** | PostgreSQL (production) / SQLite (local dev) | Neon |
| **Transactional Email** | Brevo REST API (6-digit OTP & password reset delivery) | Brevo |
| **AI Insights Engine** | Groq (`llama-3.3-70b-versatile`) + optional client-side BYOK | Groq API |

---

## Security & Authentication Architecture

1. **Email OTP Verification & Ghost Account Hygiene**
   - Newly registered accounts are created in an inactive state (`is_active = False`) with a 6-digit OTP sent via Brevo's HTTPS transactional API.
   - Unverified accounts older than 24 hours are automatically purged (`cleanup_ghost_accounts`) without affecting admin-suspended users (`otp_code IS NOT NULL` guard).

2. **Bcrypt Password Hashing & Byte-Length Enforcement**
   - Passwords are salted and hashed using `bcrypt` (12 rounds).
   - Both client and server enforce complexity rules (minimum 8 characters, at least one uppercase letter, number, and special character) alongside a strict **72-byte UTF-8 ceiling** to prevent silent bcrypt truncation or hashing exceptions.

3. **Single-Use, Type-Scoped Password Reset Tokens**
   - `/forgot-password` issues a 15-minute `HS256` JWT scoped explicitly with `"type": "reset"` and a 16-character SHA-256 fingerprint (`ph`) derived from the user's current `password_hash`.
   - Once the password is updated, the stored hash changes and the fingerprint no longer matches—immediately invalidating the link against replay attacks.
   - `/verify-reset-token` validates tokens before rendering the reset form, and `get_current_user()` rejects any JWT where `type != "access"` so reset tokens cannot authenticate protected routes.

4. **Hierarchical RBAC (User → Admin → Master Admin)**
   - **Users:** Full CRUD access scoped strictly to their own transactions.
   - **Admins:** Can view all accounts and activate or deactivate standard users.
   - **Master Admins:** Can promote/demote Admins, manage Admin account status, and are protected at the API layer against self-lockout or demotion.
   - Deactivated accounts are rejected immediately on subsequent authenticated API calls.

5. **Cross-Tab Session Synchronization**
   - Listens to browser `StorageEvent` updates on `localStorage` so logging in or out in one tab synchronizes authentication state across all open tabs.

6. **Privacy-Preserving AI Analyst (Groq + Client-Side BYOK)**
   - Summarizes recent transaction history using Groq (`llama-3.3-70b-versatile`).
   - Users can optionally supply their own Groq or Gemini API key via the `X-AI-Key` request header; custom keys are stored only in browser `localStorage` and are never written to the database.

---

## Repository Structure

```text
FinSight/
├── backend/
│   ├── auth.py             # Bcrypt password verification & scoped JWT validation
│   ├── database.py         # SQLAlchemy engine setup (PostgreSQL/psycopg2 & SQLite)
│   ├── email_service.py    # Brevo transactional email integration (OTP & reset links)
│   ├── main.py             # FastAPI routes (Auth, Transactions, Admin RBAC, AI Insights)
│   ├── migrate_admin.py    # Idempotent schema migration for admin columns
│   ├── models.py           # SQLAlchemy User & Transaction models
│   ├── safe_migrate.py     # Safe database schema migration utility
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── seed_admin.py       # Interactive CLI script to provision/promote a Master Admin
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Backend environment variable template
└── frontend/
    ├── src/
    │   ├── context/        # AuthContext with multi-tab StorageEvent sync
    │   ├── pages/          # Dashboard, Auth, RegisterPage, ForgotPassword, ResetPassword, AdminDashboard
    │   ├── api.ts          # Axios client with Bearer token interceptor
    │   └── App.tsx         # Protected & Admin route guards
    ├── vercel.json         # SPA rewrite rules for client-side routing
    └── .env.example        # Frontend environment variable template
```

---

## API Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Public | Create inactive user and dispatch 6-digit OTP email |
| `POST` | `/verify-otp` | Public | Verify 6-digit OTP (within 24h window) and activate account |
| `POST` | `/login` | Public | Authenticate credentials and issue 30-minute `access` JWT |
| `POST` | `/forgot-password` | Public | Dispatch single-use 15-minute reset link (enumeration-safe) |
| `POST` | `/verify-reset-token` | Public | Pre-validate reset JWT signature, expiry, and hash fingerprint |
| `POST` | `/reset-password` | Public | Update password hash and invalidate reset token |
| `GET` | `/me` | Authenticated | Return current user profile and role flags |
| `GET/POST` | `/transactions` | Authenticated | List or create user-scoped income/expense records |
| `PUT/DELETE` | `/transactions/{id}` | Authenticated | Update or delete a user-owned transaction |
| `GET` | `/insights` | Authenticated | Generate 3-sentence AI financial analysis (server or `X-AI-Key`) |
| `GET` | `/admin/users` | Admin | List all registered accounts and status metadata |
| `PUT` | `/admin/users/{id}/status` | Admin | Activate or suspend user accounts (hierarchy-enforced) |
| `PUT` | `/admin/users/{id}/role` | Master Admin | Promote or revoke Admin privileges |

---

## Local Development Setup

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Populate SECRET_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL, and GROQ_API_KEY in backend/.env

uvicorn main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Provisioning a Master Admin

Run the schema migration and interactive Master Admin seeder against your target database (`DATABASE_URL`):

```bash
cd backend
python3 migrate_admin.py
python3 seed_admin.py
```