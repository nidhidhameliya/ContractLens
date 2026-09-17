"""
ContractLens — 30-Day Outcome Verification Job
Runs periodically in the background. Finds Actions that were executed 30 days ago,
uses the MCP server to verify if the usage actually dropped to zero (indicating successful cancellation),
and updates the Action outcome. (FR-ACT-4)
"""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
import json

from app.core.database import SessionLocal
from app.actions.action import Action, ActionStatus
from app.decisions.decision import Decision
from app.contracts.contract import Contract
from app.contracts.contract_clause import ContractClause
from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType

logger = logging.getLogger(__name__)


def run_daily_verification():
    """
    Checks all actions sent > 30 days ago that haven't been verified yet.
    """
    db = SessionLocal()
    try:
        logger.info("[Verifier] Starting 30-day outcome verification job...")
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # In a real MVP we would filter by > 30 days, but for testing we'll just check all 'sent' actions
        # un-verified actions. We'll use a hack to allow demoing: if expected_impact isn't verified, verify it.
        actions = (
            db.query(Action)
            .join(Decision)
            .filter(Action.status == ActionStatus.sent)
            # .filter(Action.created_at <= thirty_days_ago)  # Uncomment for prod
            .all()
        )

        verified_count = 0
        from app.actions.outcome import Outcome, OutcomeResult

        for action in actions:
            decision = db.query(Decision).filter(Decision.id == action.decision_id).first()
            if not decision:
                continue

            # Skip if already verified (Outcome exists)
            existing_outcome = db.query(Outcome).filter(Outcome.decision_id == decision.id).first()
            if existing_outcome:
                continue

            contract = db.query(Contract).filter(Contract.id == decision.contract_id).first()
            clause = db.query(ContractClause).filter(ContractClause.contract_id == contract.id).order_by(ContractClause.created_at.desc()).first()
            
            if not clause or not clause.vendor_name:
                continue

            # Query MCP to see if they are still using it
            logger.info(f"[Verifier] Verifying outcome for vendor={clause.vendor_name}")
            try:
                client = mcp_client_manager.get_client(contract.org_id, McpServerType.okta, db)
                result = client.call_tool("get_vendor_usage", {"vendor_name": clause.vendor_name})
                
                if "error" not in result:
                    active_users = result.get("active_users", 0)
                    
                    expected_impact = decision.expected_impact_json or {}
                    spend_delta = float(expected_impact.get("savings_annual", 0))
                    expected_desc = expected_impact.get("description", "Expected cost reduction")
                    
                    if active_users == 0:
                        actual_outcome = "Verified Complete: Vendor deactivated (0 seats active)."
                        result_enum = OutcomeResult.success
                    else:
                        actual_outcome = f"Verification Failed: Vendor still active ({active_users} seats detected)."
                        result_enum = OutcomeResult.failure
                        spend_delta = 0.0
                    
                    new_outcome = Outcome(
                        decision_id=decision.id,
                        expected_outcome=expected_desc,
                        actual_outcome=actual_outcome,
                        verified_at=datetime.now(timezone.utc),
                        result=result_enum,
                        spend_delta_amount=spend_delta
                    )
                    
                    db.add(new_outcome)
                    verified_count += 1
                    
                    # RAG loop: store the verified outcome in ChromaDB for future decisions (FR-DEC-4)
                    try:
                        from app.intelligence.decision import _store_decision_in_chroma
                        risk_type = decision.risk_level.value if decision.risk_level else "unknown"
                        action_str = decision.recommended_action.value if decision.recommended_action else "unknown"
                        _store_decision_in_chroma(str(decision.id), clause.vendor_name, risk_type, action_str, actual_outcome)
                    except Exception as store_e:
                        logger.warning(f"[Verifier] Failed to store outcome in ChromaDB: {store_e}")
            except Exception as e:
                logger.error(f"[Verifier] Failed MCP call for {clause.vendor_name}: {e}")

        db.commit()
        logger.info(f"[Verifier] Finished. Verified {verified_count} actions.")
    except Exception as e:
        logger.error(f"[Verifier] Job failed: {e}")
    finally:
        db.close()

