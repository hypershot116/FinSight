# FinSight 📊

![Live Demo](https://img.shields.io/badge/Live_Demo-finsight--pink--zeta.vercel.app-000000?style=for-the-badge&logo=vercel)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/Database-Neon_Postgres-336791?style=for-the-badge&logo=postgresql&logoColor=white)

FinSight is a full-stack, AI-powered personal finance tracker designed for zero-latency transaction logging and intelligent financial insights. It provides strict cross-session data isolation, persistent cloud storage, and automated insights driven by Google Gemini.

> **[View the Live Platform](https://finsight-pink-zeta.vercel.app)** 

---

## 🏗️ System Architecture

FinSight is engineered as a decoupled Single Page Application (SPA) utilizing modern serverless and PaaS infrastructure:

* **Frontend:** React.js / TypeScript, state management via TanStack Query, deployed on **Vercel**.
* **Backend:** REST API built with Python/FastAPI, utilizing JWT-based stateless authentication, deployed on **Render**.
* **Database:** Cloud-native **Neon Serverless PostgreSQL**, connected via `psycopg2` and SQLAlchemy ORM.
* **AI Integration:** Direct backend integration with the **Google Gemini API** to analyze transaction patterns and generate personalized financial insights.

---

## 🚀 Core Features

* **Strict Account Isolation:** Secure JWT lifecycle management with enforced browser memory cache wiping upon logout to prevent cross-account data bleeding.
* **Persistent Cloud Data:** Zero-downtime database interactions mapped to a live Neon Postgres cluster, ensuring data survives server spins and PaaS redeployments.
* **AI-Powered Insights:** Context-aware financial summaries powered by Gemini.
* **Real-time State Sync:** Immediate UI updates upon transaction entry via aggressive TanStack Query invalidation.

---

## 💻 Local Development Setup

To run FinSight locally, you will need two terminal windows (one for the frontend, one for the backend).

### 1. Backend Setup

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

Create a `.env` file in the `backend` directory and add your credentials:

    DATABASE_URL=postgresql+psycopg2://<your_neon_db_url>
    SECRET_KEY=<your_jwt_secret>
    GEMINI_API_KEY=<your_google_gemini_key>

Run the server:

    uvicorn main:app --reload --port 8000

### 2. Frontend Setup

    cd frontend
    npm install

Create a `.env` file in the `frontend` directory:

    VITE_API_URL=http://127.0.0.1:8000

Run the development server:

    npm run dev

