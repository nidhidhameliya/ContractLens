"""
Termora — Detection Agent
Extracts structured contract clauses from raw text using Groq LLM.
Robust JSON extraction that works with any model including Qwen (think-tag aware).
Routes to manual_review if confidence < threshold (FR-DET-3).
"""

import json
import re
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.intelligence.state import ContractScanState

logger = logging.getLogger(__name__)

llm = ChatGroq(api_key=settings.groq_api_key, model_name=settings.groq_model, temperature=0.0, max_tokens=1024)

DETECTION_SYSTEM_PROMPT = """You are a contract clause extraction specialist.
Extract ONLY what is explicitly stated in the contract text below.
Return ONLY a raw JSON object — absolutely no markdown, no code fences, no explanations."""

DETECTION_USER_PROMPT_TEMPLATE = """Extract contract data from this text and return ONLY a JSON object with no markdown:

{raw_text}

Return ONLY this JSON (fill in actual values from the contract):
{{"vendor_name": null, "renewal_date": null, "auto_renew": null, "notice_period_days": null, "price_escalation_pct": null, "contract_value_annual": null, "currency": "USD", "confidence": 0.9, "ambiguous_clauses": []}}"""


def _extract_json(raw: str) -> str:
    """Strip <think> blocks, markdown fences, extract first JSON object."""
    if not raw:
        return "{}"
    # Remove Qwen think-blocks
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    # Remove markdown fences
    raw = re.sub(r"```(?:json)?", "", raw).replace("```", "")
    raw = raw.strip()
    # Extract first JSON object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    return match.group(0) if match else raw


def run_detection_agent(state: ContractScanState) -> ContractScanState:
    """LangGraph node: Detection Agent — extracts structured clauses via LLM."""
    logger.info(f"[Detection Agent] Starting for contract={state['contract_id']}")

    raw_text = state["raw_text"]
    truncated = raw_text[:6000] if len(raw_text) > 6000 else raw_text

    try:
        response = llm.invoke([
            SystemMessage(content=DETECTION_SYSTEM_PROMPT),
            HumanMessage(content=DETECTION_USER_PROMPT_TEMPLATE.format(raw_text=truncated))
        ])

        raw_output = response.content or ""
        logger.debug(f"[Detection Agent] Raw LLM output: {raw_output[:400]}")
        cleaned = _extract_json(raw_output)
        clauses = json.loads(cleaned)

        confidence = float(clauses.get("confidence", 0.8))
        logger.info(f"[Detection Agent] confidence={confidence:.2f}")

        if confidence < settings.llm_confidence_threshold:
            return {**state, "clauses": clauses, "detection_confidence": confidence,
                    "route": "manual_review", "error": f"Low confidence: {confidence:.2f}"}

        return {**state, "clauses": clauses, "detection_confidence": confidence, "route": "continue"}

    except json.JSONDecodeError as e:
        cleaned_preview = locals().get("cleaned", "")[:200]
        logger.error(f"[Detection Agent] JSON parse error: {e} | output: {cleaned_preview}")
        return {**state, "route": "manual_review", "error": f"Invalid JSON: {e}"}
    except Exception as e:
        logger.error(f"[Detection Agent] Unexpected error: {e}")
        return {**state, "route": "manual_review", "error": str(e)}
