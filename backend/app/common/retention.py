"""
Termora — Data Retention Jobs
Deletes data older than the configured retention period (FR: 24 months for audit logs).
"""

import logging
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.reports.audit_log import AuditLog

logger = logging.getLogger(__name__)

def run_retention_cleanup():
    """
    Deletes audit logs older than 24 months (Section 6.2 Data Retention).
    """
    logger.info("[Retention] Starting audit log retention cleanup...")
    db: Session = SessionLocal()
    try:
        # Calculate the cutoff date (24 months ago)
        cutoff_date = datetime.now(timezone.utc) - relativedelta(months=24)
        
        # Delete logs older than cutoff
        deleted_count = db.query(AuditLog).filter(AuditLog.timestamp < cutoff_date).delete()
        db.commit()
        
        logger.info(f"[Retention] Cleanup complete. Deleted {deleted_count} audit logs older than {cutoff_date.isoformat()}.")
    except Exception as e:
        logger.error(f"[Retention] Cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_retention_cleanup()
