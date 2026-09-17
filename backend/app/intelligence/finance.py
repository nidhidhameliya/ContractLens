"""
ContractLens — Finance Agent (LLM-powered)
Delegates financial estimation to the LLM rather than deterministic Python math.
The LLM uses its reading of the contract clauses + risk context to estimate
annual cost, potential savings, and exposure.
"""

import json
import re
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.intelligence.state import ContractScanState

logger = logging.getLogger(__name__)

llm = ChatGroq(
    api_key=settings.groq_api_key,
    model_name=settings.groq_model,
    temperature=0.1,
    max_tokens=512,
)

FINANCE_SYSTEM_PROMPT = """You are a SaaS procurement financial analyst.
Given the contract clauses and risk summary, estimate the financial impact.
Return ONLY a raw JSON object — no markdown, no code fences, no explanations."""

FINANCE_USER_PROMPT_TEMPLATE = """Estimate the financial impact of this contract. Return ONLY JSON:

CONTRACT CLAUSES:
{clauses_json}

RISK CONTEXT:
{risk_json}

Return ONLY this JSON (fill in actual numeric values in USD):
{{"annual_cost_current": 0, "annual_cost_if_renewed": 0, "price_escalation_pct": 0, "estimated_savings_if_cancelled": 0, "estimated_savings_if_renegotiated": 0, "currency": "USD", "llm_confidence_note": "one sentence explaining your estimates"}}

All values must be numbers (floats or ints). Estimate based on any pricing signals in the clauses.
If no pricing info is available, estimate conservatively based on the risk level and typical SaaS contract sizes."""


def _extract_json(raw: str) -> dict:
    """Strip markdown fences and extract JSON object."""
    raw = re.sub(r"```(?:json)?", "", raw or "").replace("```", "").strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    json_str = match.group(0) if match else raw
    return json.loads(json_str)


def run_finance_agent(state: ContractScanState) -> ContractScanState:
    """
    LangGraph node: Finance Agent.
    Uses the LLM to estimate financial impact based on contract clauses and risk context.
    """
    logger.info(f"[Finance Agent] Starting LLM estimation for contract={state['contract_id']}")

    clauses = state.get("clauses") or {}
    risk_output = state.get("risk_output") or {}

    try:
        response = llm.invoke([
            SystemMessage(content=FINANCE_SYSTEM_PROMPT),
            HumanMessage(content=FINANCE_USER_PROMPT_TEMPLATE.format(
                clauses_json=json.dumps(clauses, indent=2),
                risk_json=json.dumps(risk_output, indent=2),
            ))
        ])

        raw = response.content or ""
        logger.debug(f"[Finance Agent] Raw output: {raw[:300]}")
        finance_output = _extract_json(raw)

        # Ensure all expected numeric fields exist with float values
        for field in ["annual_cost_current", "annual_cost_if_renewed",
                      "estimated_savings_if_cancelled", "estimated_savings_if_renegotiated",
                      "price_escalation_pct"]:
            finance_output[field] = float(finance_output.get(field, 0))

        # Clamp against known value to prevent hallucinations
        known_value = clauses.get("contract_value_annual")
        if known_value is not None:
            try:
                known_value_float = float(known_value)
                max_value = known_value_float * 3
                for field in ["annual_cost_current", "annual_cost_if_renewed", 
                              "estimated_savings_if_cancelled", "estimated_savings_if_renegotiated"]:
                    if finance_output[field] > max_value:
                        logger.warning(f"[Finance Agent] Clamping {field} from {finance_output[field]} to {known_value_float} (max allowed {max_value})")
                        finance_output[field] = known_value_float
            except (ValueError, TypeError):
                pass

        logger.info(
            f"[Finance Agent] LLM estimate — "
            f"Current=${finance_output.get('annual_cost_current', 0):.2f} | "
            f"Savings(cancel)=${finance_output.get('estimated_savings_if_cancelled', 0):.2f} | "
            f"Savings(renegotiate)=${finance_output.get('estimated_savings_if_renegotiated', 0):.2f}"
        )
        return {**state, "finance_output": finance_output}

    except Exception as e:
        logger.error(f"[Finance Agent] LLM estimation failed: {e}. Falling back to zeros.")
        return {
            **state,
            "finance_output": {
                "annual_cost_current": 0.0,
                "annual_cost_if_renewed": 0.0,
                "price_escalation_pct": 0.0,
                "estimated_savings_if_cancelled": 0.0,
                "estimated_savings_if_renegotiated": 0.0,
                "currency": clauses.get("currency", "USD"),
                "llm_confidence_note": f"Estimation failed: {e}",
            }
        }

