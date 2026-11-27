from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to path so tests can find main.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app

client = TestClient(app)

def test_status_endpoint():
    # Verifies the API is online
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_login_invalid_credentials():
    # Verifies the API rejects bad passwords properly instead of crashing
    response = client.post(
        "/login",
        data={"username": "hacker@finsight.app", "password": "wrongpassword"}
    )
    assert response.status_code in [400, 401]
