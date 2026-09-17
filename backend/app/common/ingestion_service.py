"""
ContractLens — Ingestion Service
Polls configured MCP servers (Google Drive / Gmail) for new contracts,
deduplicates them, extracts text, and triggers the AI pipeline.
"""
import logging
import threading
from datetime import datetime, timezone
import json

from app.contracts.contract import Contract, ContractSource, ContractStatus
from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType
from app.common.document_parser import extract_text_from_bytes, ParseFailure
from app.common.deduplication import compute_hash, check_duplicate
from app.contracts.router import _run_pipeline
from app.core.database import SessionLocal
from app.users.user import User

logger = logging.getLogger(__name__)

def poll_drive_mcp(org_id: str, db, budget: int) -> int:
    """
    Connects to the Drive MCP server for the org, lists files,
    reads them, and ingests them into the pipeline.
    Returns the number of contracts ingested.
    """
    logger.info(f"[Ingestion] Polling Google Drive MCP for org_id={org_id}")
    try:
        client = mcp_client_manager.get_client(org_id, McpServerType.google_drive, db)
        
        # 1. List files
        list_res = client.call_tool("list_files", {"query": "contract OR MSA"})
        if "error" in list_res:
            logger.error(f"[Ingestion] Drive MCP list_files error: {list_res['error']}")
            return 0

        files = list_res if isinstance(list_res, list) else []
        if not files:
            logger.info("[Ingestion] No files found in Drive MCP.")
            return 0

        logger.info(f"[Ingestion] Drive MCP found {len(files)} files.")

        # Find an admin user email to send notifications to
        admin_user = db.query(User).filter(User.org_id == org_id).first()
        admin_email = admin_user.email if admin_user else "admin@example.com"

        # 2. Process each file
        ingested_count = 0
        for f in files:
            if ingested_count >= budget:
                logger.info(f"[Ingestion] Drive MCP LLM budget limit reached ({budget}) for org_id={org_id}")
                break

            file_id = f.get("id")
            if not file_id:
                continue

            read_res = client.call_tool("read_file", {"file_id": file_id})
            if "error" in read_res:
                logger.error(f"[Ingestion] Error reading file {file_id}: {read_res['error']}")
                continue

            content = read_res.get("content", "")
            filename = read_res.get("name", f"drive_{file_id}.txt")
            
            # Since our mock returns text content, we'll encode it to bytes
            file_bytes = content.encode("utf-8")
            file_hash = compute_hash(file_bytes)

            is_dup, existing = check_duplicate(org_id, filename, file_hash, db)
            if is_dup:
                logger.info(f"[Ingestion] Skipping duplicate file: {filename}")
                continue

            # Ingest
            logger.info(f"[Ingestion] Ingesting new contract from Drive: {filename}")
            try:
                raw_text = extract_text_from_bytes(file_bytes, filename)
                parse_status = ContractStatus.active
            except ParseFailure as e:
                raw_text = None
                parse_status = ContractStatus.parse_failed

            contract = Contract(
                org_id=org_id,
                source=ContractSource.google_drive,
                source_file_id=file_id,
                file_name=filename,
                file_hash=file_hash,
                raw_text=raw_text,
                uploaded_at=datetime.now(timezone.utc),
                status=ContractStatus.scanning if raw_text else parse_status,
            )

            db.add(contract)
            db.commit()
            db.refresh(contract)

            if raw_text:
                # Trigger the pipeline in a background thread so we don't block polling
                threading.Thread(
                    target=_run_pipeline, 
                    args=(str(contract.id), str(org_id), admin_email),
                    daemon=True
                ).start()
                
            ingested_count += 1

    except Exception as e:
        logger.error(f"[Ingestion] Failed to poll Drive MCP for org_id={org_id}: {e}")
        
    return ingested_count


def poll_gmail_mcp(org_id: str, db, budget: int) -> int:
    """
    Connects to the Gmail MCP server for the org, searches for emails with attachments,
    fetches the attachments, and ingests them into the pipeline.
    Returns the number of contracts ingested.
    """
    logger.info(f"[Ingestion] Polling Gmail MCP for org_id={org_id}")
    ingested_count = 0
    if budget <= 0:
        return 0

    try:
        from app.mcp_integration.gmail_tools import search_emails, get_attachment
        emails, log = search_emails(org_id, "has:attachment (contract OR MSA OR agreement)", db)
        if not emails:
            logger.info("[Ingestion] No emails found in Gmail MCP.")
            return 0
        
        logger.info(f"[Ingestion] Gmail MCP found {len(emails)} emails.")

        admin_user = db.query(User).filter(User.org_id == org_id).first()
        admin_email = admin_user.email if admin_user else "admin@example.com"

        for e in emails:
            if ingested_count >= budget:
                logger.info(f"[Ingestion] Gmail MCP LLM budget limit reached ({budget}) for org_id={org_id}")
                break
                
            for att_id in e.attachment_ids:
                if ingested_count >= budget:
                    break
                    
                file_bytes, att_log = get_attachment(org_id, e.message_id, att_id, db)
                filename = f"gmail_{e.message_id}_{att_id}.pdf"
                file_hash = compute_hash(file_bytes)

                is_dup, _ = check_duplicate(org_id, filename, file_hash, db)
                if is_dup:
                    logger.info(f"[Ingestion] Skipping duplicate file: {filename}")
                    continue

                logger.info(f"[Ingestion] Ingesting new contract from Gmail: {filename}")
                try:
                    raw_text = extract_text_from_bytes(file_bytes, filename)
                    parse_status = ContractStatus.active
                except ParseFailure as e_parse:
                    raw_text = None
                    parse_status = ContractStatus.parse_failed

                contract = Contract(
                    org_id=org_id,
                    source=ContractSource.gmail,
                    source_file_id=f"{e.message_id}_{att_id}",
                    file_name=filename,
                    file_hash=file_hash,
                    raw_text=raw_text,
                    uploaded_at=datetime.now(timezone.utc),
                    status=ContractStatus.scanning if raw_text else parse_status,
                )

                db.add(contract)
                db.commit()
                db.refresh(contract)

                if raw_text:
                    threading.Thread(
                        target=_run_pipeline, 
                        args=(str(contract.id), str(org_id), admin_email),
                        daemon=True
                    ).start()
                
                ingested_count += 1
                
    except Exception as e:
        logger.error(f"[Ingestion] Failed to poll Gmail MCP for org_id={org_id}: {e}")

    return ingested_count

