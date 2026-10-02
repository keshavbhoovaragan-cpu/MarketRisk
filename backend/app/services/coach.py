import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an investing educator, not a financial adviser. Explain portfolio concepts and suggest "
    "questions or learning exercises only. Never instruct the user to buy, sell, or hold a security, "
    "and never recommend a ticker, asset, allocation, or trade. Use only the supplied portfolio "
    "metrics; do not invent current market facts, prices, returns, or news. If quote data is incomplete, "
    "say so. Return only JSON with keys lesson (string) and insights (array of objects with title, "
    "detail, metric). Limit insights to three, use calm language, and label estimates as estimates."
)


async def add_ai_coaching(summary: dict[str, Any], preferences: dict[str, str], lesson: str, insights: list[dict[str, str]]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"generative_ai_connected": False, "lesson": lesson, "insights": insights}

    equity = summary.get("total_value")
    user_facts = {
        "experience_level": preferences.get("experience_level", "beginner"),
        "risk_tolerance_self_assessment": preferences.get("risk_tolerance", "moderate"),
        "investment_horizon_self_assessment": preferences.get("investment_horizon", "long_term"),
        "valuation_complete": summary.get("valuation_complete", False),
        "virtual_cash_percent": round(summary["portfolio"]["cash_balance"] / equity * 100, 1)
        if equity else None,
        "position_weights_percent": [position.get("weight") for position in summary.get("holdings", [])],
        "missing_quote_count": len(summary.get("missing_quote_tickers", [])),
        "quote_provider": summary.get("market_data", {}).get("provider"),
        "quote_realtime_guaranteed": summary.get("market_data", {}).get("realtime_guaranteed", False),
    }
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(user_facts)},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            generated = json.loads(content)
            ai_lesson = generated.get("lesson")
            ai_insights = generated.get("insights")
            if not isinstance(ai_lesson, str) or not isinstance(ai_insights, list):
                raise ValueError("AI response did not match the expected schema")
            clean_insights = []
            for item in ai_insights[:3]:
                if not isinstance(item, dict) or not all(isinstance(item.get(key), str) for key in ("title", "detail", "metric")):
                    raise ValueError("AI insight did not match the expected schema")
                clean_insights.append({"kind": "education", **{key: item[key][:500] for key in ("title", "detail", "metric")}})
            return {
                "generative_ai_connected": True,
                "ai_model": model,
                "lesson": ai_lesson[:1000],
                "insights": insights + clean_insights,
            }
    except Exception as error:
        logger.warning("Portfolio coach AI request failed (%s); using deterministic insights", type(error).__name__)
        return {"generative_ai_connected": False, "lesson": lesson, "insights": insights}