import os
import tempfile
import time
import unittest
from unittest.mock import patch

TEST_DATA_DIR = tempfile.mkdtemp(prefix="marketrisk-investing-test-")
os.environ["MARKETRISK_DATA_DIR"] = TEST_DATA_DIR
os.environ["DB_PATH"] = os.path.join(TEST_DATA_DIR, "test.db")
os.environ["SESSION_SECRET"] = "integration-test-only-session-secret"
os.environ.pop("OPENAI_API_KEY", None)

from fastapi.testclient import TestClient

from app.main import app


class InvestingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_a = TestClient(app)
        cls.client_b = TestClient(app)
        cls.client_a.__enter__()
        cls.client_b.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_a.__exit__(None, None, None)
        cls.client_b.__exit__(None, None, None)

    def setUp(self):
        timestamp = str(time.time_ns())
        response_a = self.client_a.post("/api/auth/register", json={
            "email": f"investor-a-{timestamp}@example.test",
            "password": "safe-test-password-123",
        })
        response_b = self.client_b.post("/api/auth/register", json={
            "email": f"investor-b-{timestamp}@example.test",
            "password": "safe-test-password-456",
        })
        self.assertEqual(response_a.status_code, 201, response_a.text)
        self.assertEqual(response_b.status_code, 201, response_b.text)
        self.user_a_portfolio = self.client_a.get("/api/portfolio/list").json()["portfolios"][0]["id"]
        self.user_b_portfolio = self.client_b.get("/api/portfolio/list").json()["portfolios"][0]["id"]

    def test_portfolios_are_private_and_require_authentication(self):
        self.assertNotEqual(self.user_a_portfolio, self.user_b_portfolio)
        self.assertEqual(self.client_b.get(f"/api/portfolio/{self.user_a_portfolio}/trades").status_code, 404)
        anonymous = TestClient(app)
        try:
            self.assertEqual(anonymous.get("/api/portfolio/list").status_code, 401)
        finally:
            anonymous.close()

    def test_paper_order_checks_cash_and_position_and_keeps_provider_timestamp(self):
        quote_time = int(time.time()) - 120
        prices = {"AAPL": {
            "ticker": "AAPL", "price": 125.0, "change_pct": 0.4,
            "updated_at": int(time.time()), "quote_as_of": quote_time,
            "source": "test provider", "realtime_guaranteed": False,
        }}
        with patch("app.api.routes.portfolio.get_prices_bulk", return_value=prices):
            bought = self.client_a.post(
                f"/api/portfolio/{self.user_a_portfolio}/trades",
                json={"ticker": "AAPL", "side": "BUY", "shares": 2},
            )
            self.assertEqual(bought.status_code, 201, bought.text)
            self.assertEqual(bought.json()["cash_balance"], 99_750)
            self.assertEqual(bought.json()["trade"]["quote_as_of"], quote_time)

            insufficient = self.client_a.post(
                f"/api/portfolio/{self.user_a_portfolio}/trades",
                json={"ticker": "AAPL", "side": "BUY", "shares": 1000},
            )
            self.assertEqual(insufficient.status_code, 409)

            too_many_shares = self.client_a.post(
                f"/api/portfolio/{self.user_a_portfolio}/trades",
                json={"ticker": "AAPL", "side": "SELL", "shares": 3},
            )
            self.assertEqual(too_many_shares.status_code, 409)

            sold = self.client_a.post(
                f"/api/portfolio/{self.user_a_portfolio}/trades",
                json={"ticker": "AAPL", "side": "SELL", "shares": 1},
            )
            self.assertEqual(sold.status_code, 201, sold.text)
            history = self.client_a.get(f"/api/portfolio/{self.user_a_portfolio}/trades").json()["trades"]
            self.assertEqual(len(history), 2)
            self.assertEqual(history[0]["quote_as_of"], quote_time)
            self.assertEqual(self.client_b.get("/api/portfolio/list").json()["portfolios"][0]["cash_balance"], 100_000)

    def test_preferences_watchlist_and_explainable_coach_are_per_user(self):
        saved = self.client_a.put("/api/auth/preferences", json={
            "experience_level": "advanced",
            "risk_tolerance": "conservative",
            "investment_horizon": "long_term",
        })
        self.assertEqual(saved.status_code, 200)
        self.client_a.post("/api/portfolio/watchlist/MSFT")
        self.assertEqual(self.client_a.get("/api/portfolio/watchlist").json()["watchlist"][0]["ticker"], "MSFT")
        self.assertEqual(self.client_b.get("/api/portfolio/watchlist").json()["watchlist"], [])

        coach = self.client_a.get(f"/api/portfolio/{self.user_a_portfolio}/coach")
        self.assertEqual(coach.status_code, 200, coach.text)
        self.assertEqual(coach.json()["mode"], "explainable_rules")
        self.assertFalse(coach.json()["generative_ai_connected"])
        self.assertEqual(coach.json()["preferences"]["experience_level"], "advanced")

    def test_missing_quote_marks_valuation_incomplete(self):
        quote = {"AAPL": {
            "ticker": "AAPL", "price": 100.0, "change_pct": 0.0,
            "updated_at": int(time.time()), "quote_as_of": int(time.time()),
            "source": "test provider", "realtime_guaranteed": False,
        }}
        with patch("app.api.routes.portfolio.get_prices_bulk", return_value=quote):
            placed = self.client_a.post(
                f"/api/portfolio/{self.user_a_portfolio}/trades",
                json={"ticker": "AAPL", "side": "BUY", "shares": 1},
            )
            self.assertEqual(placed.status_code, 201, placed.text)
        with patch("app.api.routes.portfolio.get_prices_bulk", return_value={}):
            portfolio = self.client_a.get(f"/api/portfolio/?portfolio_id={self.user_a_portfolio}").json()
            self.assertFalse(portfolio["valuation_complete"])
            self.assertIsNone(portfolio["total_value"])
            self.assertEqual(portfolio["missing_quote_tickers"], ["AAPL"])
            self.assertIsNone(portfolio["holdings"][0]["market_value"])

    def test_risk_requires_a_position_for_new_empty_portfolio(self):
        response = self.client_a.get(f"/api/risk/portfolio?portfolio_id={self.user_a_portfolio}")
        self.assertEqual(response.status_code, 422)
        self.assertIn("Add at least one paper position", response.json()["detail"])

    def test_logout_revokes_the_server_session(self):
        self.assertEqual(self.client_a.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.client_a.post("/api/auth/logout").status_code, 204)
        self.assertEqual(self.client_a.get("/api/auth/me").status_code, 401)


if __name__ == "__main__":
    unittest.main()