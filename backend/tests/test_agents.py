"""
ContractLens — Unit Tests
pytest suite for agents, rules, and API routes.
Run: cd backend && pytest tests/ -v
"""

import json
import pytest
from unittest.mock import patch, MagicMock


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_state(overrides: dict = {}) -> dict:
    base = {
        "contract_id": "00000000-0000-0000-0000-000000000001",
        "org_id": "00000000-0000-0000-0000-000000000002",
        "raw_text": "This is a sample contract text for testing.",
        "clauses": {},
        "risk_output": {},
        "finance_output": {},
        "decision_output": {},
        "mcp_tool_calls": [],
        "requires_approval": False,
        "requires_second_approver": False,
        "route": "continue",
    }
    base.update(overrides)
    return base


# ──────────────────────────────────────────────────────────────────────────────
# P1: Detection Agent
# ──────────────────────────────────────────────────────────────────────────────

class TestDetectionAgent:
    def test_routes_to_continue_on_high_confidence(self):
        """High-confidence LLM output should set route='continue'."""
        from app.intelligence.detection import _extract_json

        raw = '```json\n{"vendor_name": "Salesforce", "confidence": 0.95}\n```'
        extracted = _extract_json(raw)
        data = json.loads(extracted)
        assert data["vendor_name"] == "Salesforce"
        assert float(data["confidence"]) >= 0.6

    def test_strips_think_blocks(self):
        """Should remove <think>...</think> blocks from Qwen output."""
        from app.intelligence.detection import _extract_json

        raw = '<think>Let me think...</think>{"vendor_name": "Slack", "confidence": 0.88}'
        extracted = _extract_json(raw)
        data = json.loads(extracted)
        assert data["vendor_name"] == "Slack"

    def test_routes_to_manual_review_on_low_confidence(self):
        """If LLM returns confidence below threshold, route should be 'manual_review'."""
        mock_response = MagicMock()
        mock_response.content = '{"vendor_name": "Unknown", "confidence": 0.3}'

        with patch("app.intelligence.detection.llm") as mock_llm, \
             patch("app.core.config.settings") as mock_settings:
            mock_llm.invoke.return_value = mock_response
            mock_settings.llm_confidence_threshold = 0.6

            from app.intelligence.detection import run_detection_agent
            state = _make_state({"raw_text": "Short ambiguous text"})
            result = run_detection_agent(state)
            assert result["route"] == "manual_review"

    def test_returns_manual_review_on_json_error(self):
        """Malformed LLM output should route to manual_review, not crash."""
        mock_response = MagicMock()
        mock_response.content = "NOT VALID JSON AT ALL"

        with patch("app.intelligence.detection.llm") as mock_llm:
            mock_llm.invoke.return_value = mock_response
            from app.intelligence.detection import run_detection_agent
            state = _make_state()
            result = run_detection_agent(state)
            assert result["route"] == "manual_review"


# ──────────────────────────────────────────────────────────────────────────────
# P2: Risk Agent
# ──────────────────────────────────────────────────────────────────────────────

class TestRiskAgent:
    def test_parses_risk_output_correctly(self):
        """Risk agent should parse the LLM's JSON risk assessment."""
        mock_response = MagicMock()
        mock_response.content = '{"risk_type": "price_escalation", "risk_severity": "high", "evidence": "15% escalation"}'

        with patch("app.intelligence.risk.llm") as mock_llm:
            mock_llm.invoke.return_value = mock_response
            from app.intelligence.risk import run_risk_agent
            state = _make_state({
                "clauses": {"vendor_name": "Salesforce", "price_escalation_pct": 15},
                "usage_signals": None,
            })
            result = run_risk_agent(state)
            assert result["risk_output"]["risk_type"] == "price_escalation"
            assert result["risk_output"]["risk_severity"] == "high"

    def test_returns_low_risk_on_failure(self):
        """Risk agent failure should fallback to low risk, not crash."""
        with patch("app.intelligence.risk.llm") as mock_llm:
            mock_llm.invoke.side_effect = Exception("API timeout")
            from app.intelligence.risk import run_risk_agent
            result = run_risk_agent(_make_state())
            assert result["risk_output"]["risk_severity"] == "low"


# ──────────────────────────────────────────────────────────────────────────────
# P3: Finance Agent
# ──────────────────────────────────────────────────────────────────────────────

class TestFinanceAgent:
    def test_parses_llm_savings_estimate(self):
        """Finance agent should parse LLM savings estimate into floats."""
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            "annual_cost_current": 120000,
            "annual_cost_if_renewed": 138000,
            "price_escalation_pct": 15,
            "estimated_savings_if_cancelled": 138000,
            "estimated_savings_if_renegotiated": 18000,
            "currency": "USD",
            "llm_confidence_note": "Based on contract value and 15% escalation",
        })

        with patch("app.intelligence.finance.llm") as mock_llm:
            mock_llm.invoke.return_value = mock_response
            from app.intelligence.finance import run_finance_agent
            state = _make_state({
                "clauses": {"vendor_name": "Salesforce", "contract_value_annual": 120000},
                "risk_output": {"risk_severity": "high"},
            })
            result = run_finance_agent(state)
            assert result["finance_output"]["estimated_savings_if_cancelled"] == 138000.0
            assert result["finance_output"]["estimated_savings_if_renegotiated"] == 18000.0

    def test_returns_zeros_on_failure(self):
        """Finance agent failure should fallback to zero savings, not crash."""
        with patch("app.intelligence.finance.llm") as mock_llm:
            mock_llm.invoke.side_effect = Exception("LLM unavailable")
            from app.intelligence.finance import run_finance_agent
            result = run_finance_agent(_make_state())
            assert result["finance_output"]["estimated_savings_if_cancelled"] == 0.0


# ──────────────────────────────────────────────────────────────────────────────
# P4: Decision Rules
# ──────────────────────────────────────────────────────────────────────────────

class TestDecisionRules:
    def _mock_settings(self, threshold=5000, second_threshold=None):
        mock_settings = MagicMock()
        mock_settings.approval_threshold_usd = threshold
        mock_settings.second_approver_threshold_usd = second_threshold
        return mock_settings

    def test_requires_approval_when_savings_exceed_threshold(self):
        """Savings above threshold → requires_approval = True."""
        mock_org = MagicMock()
        mock_org.approval_threshold_usd = 5000
        mock_org.second_approver_threshold_usd = None

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_org

        with patch("app.decisions.decision_rules.SessionLocal", return_value=mock_db):
            from app.decisions.decision_rules import apply_approval_rules
            state = _make_state({
                "org_id": "00000000-0000-0000-0000-000000000002",
                "decision_output": {
                    "expected_impact": {"savings_annual": 50000},
                    "risk": "high",
                }
            })
            result = apply_approval_rules(state)
            assert result["requires_approval"] is True
            assert result["route"] == "awaiting_approval"

    def test_auto_approves_below_threshold(self):
        """Savings below threshold → requires_approval = False, auto_log route."""
        mock_org = MagicMock()
        mock_org.approval_threshold_usd = 5000
        mock_org.second_approver_threshold_usd = None

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_org

        with patch("app.decisions.decision_rules.SessionLocal", return_value=mock_db):
            from app.decisions.decision_rules import apply_approval_rules
            state = _make_state({
                "org_id": "00000000-0000-0000-0000-000000000002",
                "decision_output": {
                    "expected_impact": {"savings_annual": 1000},
                    "risk": "low",
                }
            })
            result = apply_approval_rules(state)
            assert result["requires_approval"] is False
            assert result["route"] == "auto_log"

    def test_requires_second_approver_above_second_threshold(self):
        """Savings above second_approver_threshold → requires_second_approver = True."""
        mock_org = MagicMock()
        mock_org.approval_threshold_usd = 5000
        mock_org.second_approver_threshold_usd = 25000

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_org

        with patch("app.decisions.decision_rules.SessionLocal", return_value=mock_db):
            from app.decisions.decision_rules import apply_approval_rules
            state = _make_state({
                "org_id": "00000000-0000-0000-0000-000000000002",
                "decision_output": {
                    "expected_impact": {"savings_annual": 100000},
                    "risk": "high",
                }
            })
            result = apply_approval_rules(state)
            assert result["requires_second_approver"] is True

