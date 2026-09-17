"""
Termora — Decision Agent (ChromaDB-powered RAG)
Synthesizes Detection, Risk, and Finance agent outputs into a recommendation.
Uses ChromaDB for semantic retrieval of past successful decisions.
"""

import json
import re
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.intelligence.state import ContractScanState

logger = logging.getLogger(__name__)

llm = ChatGroq(api_key=settings.groq_api_key, model_name=settings.groq_model, temperature=0.1, max_tokens=768)


def _extract_json(raw: str) -> str:
    """Strip Qwen think-blocks, markdown fences, extract first JSON object."""
    raw = re.sub(r"<think>.*?</think>", "", raw or "", flags=re.DOTALL)
    raw = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    return match.group(0) if match else raw


# ── ChromaDB setup ─────────────────────────────────────────────────────────────

import chromadb
from chromadb.utils import embedding_functions

_chroma_client = None
_chroma_collection = None

def _get_chroma_collection():
    """Lazily initialises the persistent ChromaDB client and collection."""
    global _chroma_client, _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection

    # Persist data locally so it survives restarts
    _chroma_client = chromadb.PersistentClient(path="./.chromadb_store")

    # Use the built-in sentence-transformers embedding function (all-MiniLM-L6-v2)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    _chroma_collection = _chroma_client.get_or_create_collection(
        name="Termora_decisions",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    return _chroma_collection


def _store_decision_in_chroma(decision_id: str, vendor: str, risk_type: str, action: str, outcome: str):
    """Upserts a completed decision into ChromaDB for future RAG retrieval."""
    try:
        col = _get_chroma_collection()
        document = f"Vendor: {vendor}. Risk: {risk_type}. Action: {action}. Outcome: {outcome}"
        col.upsert(
            ids=[decision_id],
            documents=[document],
            metadatas=[{"vendor": vendor, "action": action, "outcome": outcome}],
        )
        logger.info(f"[ChromaDB] Stored decision {decision_id}")
    except Exception as e:
        logger.warning(f"[ChromaDB] Failed to store decision: {e}")


def _query_historical_outcomes(vendor: str, risk_type: str) -> str:
    """Retrieves the top-3 most similar past decisions from ChromaDB."""
    try:
        col = _get_chroma_collection()
        if col.count() == 0:
            return "None"

        query_text = f"Vendor: {vendor}. Risk: {risk_type}"
        results = col.query(
            query_texts=[query_text],
            n_results=min(3, col.count()),
        )

        docs = results.get("documents", [[]])[0]
        if not docs:
            return "None"

        return "\n".join(f"- {doc}" for doc in docs)
    except Exception as e:
        logger.warning(f"[ChromaDB] RAG query failed: {e}")
        return "None"


# ── Prompts ────────────────────────────────────────────────────────────────────

DECISION_SYSTEM_PROMPT = """You are a SaaS procurement advisor.
Given contract data and risk/finance analysis, write a concise business recommendation.
Return ONLY a raw JSON object — no markdown, no code fences, no explanations."""

DECISION_USER_PROMPT_TEMPLATE = """Provide a procurement recommendation based on this analysis. Return ONLY JSON:

CLAUSES: {clauses_json}

RISK: {risk_json}

FINANCE: {finance_json}

PAST SIMILAR OUTCOMES:
{historical_outcomes}


Return ONLY this JSON (fill in actual values):
{{"situation": "one sentence describing urgency", "root_cause": "one sentence on why this is a problem", "recommended_action": "renegotiate_seats", "expected_impact": {{"savings_annual": 0, "description": "one sentence outcome"}}, "risk": "high", "confidence": 0.85}}

recommended_action must be one of: cancel, renegotiate_seats, renew, manual_review
risk must be one of: low, medium, high"""


# ── Main node ─────────────────────────────────────────────────────────────────

def run_decision_agent(state: ContractScanState) -> ContractScanState:
    """LangGraph node: Decision Agent. Runs after Risk and Finance agents join."""
    logger.info(f"[Decision Agent] Starting for contract={state['contract_id']}")

    clauses = state.get("clauses", {})
    risk_output = state.get("risk_output", {})
    finance_output = state.get("finance_output", {})

    vendor = clauses.get("vendor_name", "unknown")
    risk_type = risk_output.get("risk_type", "")

    # ── RAG: query ChromaDB for historical context ─────────────────────────────
    historical_outcomes_str = _query_historical_outcomes(vendor, risk_type)

    try:
        response = llm.invoke([
            SystemMessage(content=DECISION_SYSTEM_PROMPT),
            HumanMessage(content=DECISION_USER_PROMPT_TEMPLATE.format(
                clauses_json=json.dumps(clauses, indent=2),
                risk_json=json.dumps(risk_output, indent=2),
                finance_json=json.dumps(finance_output, indent=2),
                historical_outcomes=historical_outcomes_str,
            ))
        ])

        raw = response.content or ""
        logger.debug(f"[Decision Agent] Raw output: {raw[:400]}")
        decision_output = json.loads(_extract_json(raw))

        # Use finance agent's LLM-estimated savings as the canonical impact figure
        finance_savings = finance_output.get("estimated_savings_if_cancelled", 0)
        renegotiate_savings = finance_output.get("estimated_savings_if_renegotiated", 0)
        rec = decision_output.get("recommended_action", "manual_review")
        if "expected_impact" not in decision_output:
            decision_output["expected_impact"] = {}
        if rec == "cancel":
            decision_output["expected_impact"]["savings_annual"] = finance_savings
        elif rec == "renegotiate_seats":
            decision_output["expected_impact"]["savings_annual"] = renegotiate_savings

        logger.info(f"[Decision Agent] action={rec} confidence={decision_output.get('confidence')}")
        return {**state, "decision_output": decision_output}

    except Exception as e:
        logger.error(f"[Decision Agent] Error: {e}")
        return {
            **state,
            "decision_output": {
                "situation": "Decision synthesis failed",
                "root_cause": str(e),
                "recommended_action": "manual_review",
                "expected_impact": {"savings_annual": 0, "description": "Manual review required"},
                "risk": risk_output.get("risk_severity", "medium"),
                "confidence": 0.0,
            },
        }
