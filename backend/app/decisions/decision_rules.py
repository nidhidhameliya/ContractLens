"""
ContractLens — Deterministic Rule Layer
Sets requires_human_approval based on org-configured thresholds.
This is pure Python — no LLM, no MCP, no external calls. (FR-DEC-2)
Lives entirely outside the agent reasoning path to prevent any LLM influence on approval routing.
"""

import logging
from app.intelligence.state import ContractScanState
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.org_settings import OrgSettings

logger = logging.getLogger(__name__)


def apply_approval_rules(state: ContractScanState) -> ContractScanState:
    """
    LangGraph node: Deterministic Rule Check.
    Determines requires_approval based on:
      1. Estimated savings/exposure exceeds APPROVAL_THRESHOLD_USD
      2. Risk level is "high"
    If neither condition applies, the decision is auto-approved as informational (FR-DEC-3).
    """
    decision = state.get("decision_output", {})
    expected_impact = decision.get("expected_impact", {})
    savings_annual = float(expected_impact.get("savings_annual", 0))
    risk_level = decision.get("risk", "low")

    db = SessionLocal()
    try:
        org_settings = db.query(OrgSettings).filter(OrgSettings.org_id == state["org_id"]).first()
        threshold = org_settings.approval_threshold_usd if org_settings else settings.approval_threshold_usd
    finally:
        db.close()

    requires_approval = False
    reasons = []

    if savings_annual > threshold:
        requires_approval = True
        reasons.append(f"Estimated savings ${savings_annual:.0f} > threshold ${threshold:.0f}")

    if requires_approval:
        requires_second_approver = False
        if org_settings and org_settings.second_approver_threshold_usd and savings_annual > org_settings.second_approver_threshold_usd:
            requires_second_approver = True
            reasons.append(f"Estimated savings > second approver threshold ${org_settings.second_approver_threshold_usd:.0f}")
            
        logger.info(f"[Rule Layer] Approval REQUIRED for contract={state['contract_id']}. Reasons: {'; '.join(reasons)}")
        route = "awaiting_approval"
    else:
        requires_second_approver = False
        logger.info(f"[Rule Layer] Auto-approving (informational) for contract={state['contract_id']}")
        route = "auto_log"

    return {
        **state,
        "requires_approval": requires_approval,
        "requires_second_approver": requires_second_approver,
        "route": route,
    }

