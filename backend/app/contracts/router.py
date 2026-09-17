"""
ContractLens — Contracts API Router
Full CRUD + scan trigger + manual upload endpoints.
All queries are scoped to the authenticated user's org_id (B.6 multi-tenancy).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.core.rbac import require_user_or_admin
from app.users.user import User
from app.contracts.contract import Contract, ContractSource, ContractStatus
from app.contracts.contract_clause import ContractClause
from app.intelligence.agent_run import AgentRun
from app.decisions.decision import Decision
from app.common.document_parser import extract_text_from_bytes, ParseFailure
from app.common.deduplication import compute_hash, check_duplicate

router = APIRouter()


@router.get("")
def list_contracts(
    risk_level: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists all contracts for the org, filterable by risk and status."""
    query = db.query(Contract).filter(Contract.org_id == current_user.org_id)

    if status:
        query = query.filter(Contract.status == status)

    contracts = query.order_by(Contract.created_at.desc()).all()

    result = []
    for c in contracts:
        latest_decision = (
            db.query(Decision)
            .filter(Decision.contract_id == c.id)
            .order_by(Decision.decided_at.desc())
            .first()
        )
        latest_clause = (
            db.query(ContractClause)
            .filter(ContractClause.contract_id == c.id)
            .order_by(ContractClause.created_at.desc())
            .first()
        ) if hasattr(ContractClause, 'created_at') else None

        contract_data = {
            "id": str(c.id),
            "file_name": c.file_name,
            "source": c.source.value,
            "status": c.status.value,
            "last_scanned_at": c.last_scanned_at.isoformat() if c.last_scanned_at else None,
            "vendor_name": latest_clause.vendor_name if latest_clause else None,
            "renewal_date": str(latest_clause.renewal_date) if latest_clause and latest_clause.renewal_date else None,
            "annual_value": latest_clause.contract_value_annual if latest_clause else None,
            "risk_level": latest_decision.risk_level.value if latest_decision and latest_decision.risk_level else None,
            "approval_status": latest_decision.approval_status.value if latest_decision else None,
        }

        # Apply risk_level filter if provided
        if risk_level and contract_data["risk_level"] != risk_level:
            continue

        result.append(contract_data)

    return {"contracts": result, "total": len(result)}


@router.get("/{contract_id}")
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns full contract detail including clauses, agent runs, and decisions."""
    contract = (
        db.query(Contract)
        .filter(Contract.id == uuid.UUID(contract_id), Contract.org_id == current_user.org_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    clauses = db.query(ContractClause).filter(ContractClause.contract_id == contract.id).all()
    agent_runs = db.query(AgentRun).filter(AgentRun.contract_id == contract.id).order_by(AgentRun.started_at).all()
    decisions = db.query(Decision).filter(Decision.contract_id == contract.id).order_by(Decision.decided_at.desc()).all()

    return {
        "id": str(contract.id),
        "file_name": contract.file_name,
        "source": contract.source.value,
        "status": contract.status.value,
        "raw_text_preview": (contract.raw_text or "")[:500] + "..." if contract.raw_text else None,
        "last_scanned_at": contract.last_scanned_at.isoformat() if contract.last_scanned_at else None,
        "clauses": [
            {
                "id": str(c.id),
                "vendor_name": c.vendor_name,
                "renewal_date": str(c.renewal_date) if c.renewal_date else None,
                "auto_renew": c.auto_renew,
                "notice_period_days": c.notice_period_days,
                "price_escalation_pct": c.price_escalation_pct,
                "contract_value_annual": c.contract_value_annual,
                "currency": c.currency,
                "extraction_confidence": c.extraction_confidence,
                "ambiguous_clauses": c.ambiguous_clauses,
            }
            for c in clauses
        ],
        "agent_runs": [
            {
                "id": str(r.id),
                "agent_name": r.agent_name,
                "confidence": r.confidence,
                "reasoning_summary": r.reasoning_summary,
                "mcp_tool_calls": r.mcp_tool_calls_json or [],
                "status": r.status.value,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in agent_runs
        ],
        "decisions": [
            {
                "id": str(d.id),
                "situation": d.situation,
                "root_cause": d.root_cause,
                "recommended_action": d.recommended_action.value if d.recommended_action else None,
                "expected_impact": d.expected_impact_json,
                "risk_level": d.risk_level.value if d.risk_level else None,
                "confidence": d.confidence,
                "requires_approval": d.requires_approval,
                "approval_status": d.approval_status.value,
                "decided_at": d.decided_at.isoformat() if d.decided_at else None,
            }
            for d in decisions
        ],
    }


@router.post("/upload", status_code=201)
async def upload_contract(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_or_admin),
):
    """Manual contract upload endpoint (FR-ING-3). Parses text and creates a contract row."""
    if not file.filename.lower().endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported")

    file_bytes = await file.read()
    file_hash = compute_hash(file_bytes)

    # Deduplication check
    is_duplicate, existing = check_duplicate(current_user.org_id, file.filename, file_hash, db)
    if is_duplicate:
        return {"message": "Duplicate file — already ingested", "contract_id": str(existing.id)}

    # Text extraction
    try:
        raw_text = extract_text_from_bytes(file_bytes, file.filename)
        parse_status = ContractStatus.active
    except ParseFailure as e:
        raw_text = None
        parse_status = ContractStatus.parse_failed

    contract = Contract(
        org_id=current_user.org_id,
        source=ContractSource.manual_upload,
        source_file_id=file.filename,
        file_name=file.filename,
        file_hash=file_hash,
        raw_text=raw_text,
        uploaded_at=datetime.now(timezone.utc),
        status=parse_status,
    )

    if existing:  # Updated file — update existing record
        existing.raw_text = raw_text
        existing.file_hash = file_hash
        existing.status = parse_status
        db.commit()
        return {"message": "Contract updated", "contract_id": str(existing.id)}

    db.add(contract)
    db.commit()
    db.refresh(contract)

    return {
        "message": "Contract uploaded successfully",
        "contract_id": str(contract.id),
        "status": parse_status.value,
    }


@router.post("/{contract_id}/scan")
def trigger_scan(
    contract_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_or_admin),
):
    """Triggers an immediate scan for a specific contract."""
    contract = (
        db.query(Contract)
        .filter(Contract.id == uuid.UUID(contract_id), Contract.org_id == current_user.org_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if not contract.raw_text:
        raise HTTPException(status_code=400, detail="Contract has no extracted text to scan")

    contract.status = ContractStatus.scanning
    db.commit()

    # Background task: run the LangGraph pipeline
    background_tasks.add_task(
        _run_pipeline, 
        contract_id=str(contract.id), 
        org_id=str(current_user.org_id),
        user_email=current_user.email
    )

    return {"message": "Scan triggered", "contract_id": contract_id}


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_or_admin),
):
    """Deletes a contract and its associated data."""
    contract = (
        db.query(Contract)
        .filter(Contract.id == uuid.UUID(contract_id), Contract.org_id == current_user.org_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
        
    db.delete(contract)
    db.commit()
    return None


def _run_pipeline(contract_id: str, org_id: str, user_email: str):
    """Background task that runs the LangGraph pipeline for a contract."""
    from app.core.database import SessionLocal
    from app.intelligence.graph import ContractLens_graph

    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == uuid.UUID(contract_id)).first()
        if not contract:
            return

        initial_state = {
            "contract_id": contract_id,
            "org_id": org_id,
            "raw_text": contract.raw_text or "",
            "file_name": contract.file_name,
            "clauses": None,
            "detection_confidence": None,
            "usage_signals": None,
            "risk_output": None,
            "finance_output": None,
            "decision_output": None,
            "requires_approval": True,
            "mcp_tool_calls": [],
            "error": None,
            "route": "continue",
        }

        result = ContractLens_graph.invoke(initial_state, config={"thread_id": contract_id})

        # Persist results to DB
        _persist_pipeline_results(contract, result, db, user_email)

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Pipeline failed for contract {contract_id}: {e}")
        if contract:
            contract.status = ContractStatus.parse_failed
            db.commit()
    finally:
        db.close()


def _persist_pipeline_results(contract: Contract, result: dict, db: Session, user_email: str):
    """Saves agent outputs to the database after the LangGraph pipeline completes."""
    import threading
    from datetime import timezone
    from app.contracts.contract_clause import ContractClause
    from app.decisions.decision import Decision, RiskLevel, RecommendedAction, ApprovalStatus
    from app.intelligence.agent_run import AgentRun, AgentRunStatus
    from app.integrations.email_service import send_high_risk_alert, send_approval_request

    clauses_data = result.get("clauses")
    if clauses_data:
        clause = ContractClause(
            contract_id=contract.id,
            vendor_name=clauses_data.get("vendor_name"),
            renewal_date=clauses_data.get("renewal_date"),
            auto_renew=clauses_data.get("auto_renew"),
            notice_period_days=clauses_data.get("notice_period_days"),
            price_escalation_pct=clauses_data.get("price_escalation_pct"),
            contract_value_annual=clauses_data.get("contract_value_annual"),
            currency=clauses_data.get("currency", "USD"),
            extraction_confidence=result.get("detection_confidence"),
            raw_extraction_json=clauses_data,
            ambiguous_clauses=clauses_data.get("ambiguous_clauses"),
        )
        db.add(clause)

    decision_data = result.get("decision_output")
    if decision_data:
        # Safely cast LLM strings to enum values; fall back to None on unknown values
        raw_risk = (decision_data.get("risk") or "").strip().lower()
        raw_action = (decision_data.get("recommended_action") or "").strip().lower()
        try:
            risk_enum = RiskLevel(raw_risk)
        except ValueError:
            risk_enum = None
        try:
            action_enum = RecommendedAction(raw_action)
        except ValueError:
            action_enum = RecommendedAction.manual_review

        decision = Decision(
            contract_id=contract.id,
            situation=decision_data.get("situation"),
            root_cause=decision_data.get("root_cause"),
            recommended_action=action_enum,
            expected_impact_json=decision_data.get("expected_impact"),
            risk_level=risk_enum,
            confidence=decision_data.get("confidence"),
            embedding=decision_data.get("embedding"),
            requires_approval=result.get("requires_approval", True),
            approval_status=ApprovalStatus.pending if result.get("requires_approval") else ApprovalStatus.auto_approved,
            decided_at=datetime.now(timezone.utc),
        )
        db.add(decision)

    # ── Persist Agent Runs for the UI Pipeline Tab ──
    now = datetime.now(timezone.utc)
    # Detection
    if clauses_data:
        db.add(AgentRun(
            contract_id=contract.id,
            agent_name="detection",
            status=AgentRunStatus.completed,
            reasoning_summary="Successfully extracted contract clauses via LLM.",
            confidence=result.get("detection_confidence", 0.9),
            started_at=now,
            completed_at=now,
        ))
    
    # Risk
    if result.get("risk_output"):
        db.add(AgentRun(
            contract_id=contract.id,
            agent_name="risk",
            status=AgentRunStatus.completed,
            reasoning_summary=result["risk_output"].get("risk_severity", "Analyzed risk factors."),
            confidence=0.9,
            started_at=now,
            completed_at=now,
        ))

    # Finance
    if result.get("finance_output"):
        db.add(AgentRun(
            contract_id=contract.id,
            agent_name="finance",
            status=AgentRunStatus.completed,
            reasoning_summary=f"Estimated savings: {result['finance_output'].get('estimated_savings_if_cancelled', 0)}",
            confidence=0.9,
            started_at=now,
            completed_at=now,
        ))

    # Decision
    if decision_data:
        db.add(AgentRun(
            contract_id=contract.id,
            agent_name="decision",
            status=AgentRunStatus.completed,
            reasoning_summary=decision_data.get("situation", "Synthesized final decision."),
            confidence=decision_data.get("confidence", 0.9),
            mcp_tool_calls_json=result.get("mcp_tool_calls", []),
            started_at=now,
            completed_at=now,
        ))

    contract.last_scanned_at = now
    contract.status = ContractStatus.active if result.get("route") != "manual_review" else ContractStatus.manual_review
    db.commit()


    # Fire email notifications based on the result
    if decision_data and clauses_data:
        risk = decision_data.get("risk")
        vendor = clauses_data.get("vendor_name", "Vendor")
        impact = decision_data.get("expected_impact", {})
        savings = impact.get("savings_annual", 0) if isinstance(impact, dict) else 0

        # Trigger 1: High Risk Alert
        if risk in ["high", "medium"]:
            threading.Thread(
                target=send_high_risk_alert,
                args=(
                    user_email, vendor, str(contract.id), risk,
                    decision_data.get("situation", ""),
                    decision_data.get("recommended_action", ""),
                    clauses_data.get("contract_value_annual", 0),
                    savings
                ),
                daemon=True
            ).start()

        # Trigger 2: Approval Request (Email + Slack MCP)
        if result.get("requires_approval", True):
            threading.Thread(
                target=send_approval_request,
                args=(
                    user_email, vendor, str(decision.id), risk,
                    decision_data.get("recommended_action", ""),
                    decision_data.get("situation", ""),
                    decision_data.get("root_cause", ""),
                    savings
                ),
                daemon=True
            ).start()
            
            from app.integrations.slack_service import send_slack_approval_request
            slack_decision_details = {
                "vendor_name": vendor,
                "recommended_action": decision_data.get("recommended_action", ""),
                "expected_savings": savings
            }
            threading.Thread(
                target=send_slack_approval_request,
                args=(str(contract.org_id), str(contract.id), slack_decision_details),
                daemon=True
            ).start()

