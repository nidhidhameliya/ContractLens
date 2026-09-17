"""
ContractLens — Email Notification Service
Sends transactional emails for all key pipeline events using Gmail SMTP.
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str, text: str = "") -> bool:
    """Core SMTP sender. Returns True on success."""
    if not settings.mail_username or not settings.mail_password:
        logger.warning("[Email] No credentials set — skipping.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"ContractLens AI <{settings.mail_from}>"
        msg["To"] = to
        if text:
            msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.mail_server, settings.mail_port) as s:
            s.ehlo()
            if settings.mail_starttls:
                s.starttls()
                s.ehlo()
            s.login(settings.mail_username, settings.mail_password)
            s.sendmail(settings.mail_from, to, msg.as_string())
        logger.info(f"[Email] ✓ Sent '{subject}' → {to}")
        return True
    except Exception as e:
        logger.error(f"[Email] ✗ Failed '{subject}' → {to}: {e}")
        return False


def _wrap(content: str) -> str:
    """Branded HTML wrapper."""
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;margin:0;padding:20px}}
.card{{max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px;border:1px solid #2d2d5e;overflow:hidden}}
.hdr{{background:linear-gradient(135deg,#6c63ff,#4834d4);padding:24px 32px}}
.hdr h1{{color:white;margin:0;font-size:22px;font-weight:700}}.hdr p{{color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px}}
.body{{padding:32px;color:#e0e0e0;line-height:1.6}}
h2{{color:white;margin:0 0 8px}}.sub{{color:#aaa;margin:0 0 24px}}
.badge{{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}}
.high{{background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.3)}}
.medium{{background:rgba(245,158,11,.2);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}}
.low{{background:rgba(34,197,94,.2);color:#4ade80;border:1px solid rgba(34,197,94,.3)}}
.info{{background:rgba(99,102,241,.2);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)}}
.metric{{background:#12122a;border-radius:8px;padding:16px 20px;margin:12px 0;border-left:3px solid #6c63ff}}
.lbl{{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}}
.val{{font-size:20px;font-weight:700;color:white;margin-top:4px}}
.btn{{display:inline-block;background:linear-gradient(135deg,#6c63ff,#4834d4);color:white!important;
      padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:20px}}
.ftr{{padding:20px 32px;border-top:1px solid #2d2d5e;font-size:12px;color:#555}}
table{{width:100%;border-collapse:collapse;margin:16px 0}}
th{{text-align:left;font-size:11px;color:#888;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #2d2d5e}}
td{{padding:10px 0;border-bottom:1px solid #1e1e3a;font-size:14px;color:#ccc}}
.preview{{background:#12122a;border-radius:8px;padding:16px 20px;margin:16px 0;border:1px solid #2d2d5e}}
</style></head><body><div class="card">
<div class="hdr"><h1>🔍 ContractLens</h1><p>AI Contract Risk Monitor</p></div>
<div class="body">{content}</div>
<div class="ftr">ContractLens · AI-Powered Contract Intelligence · {datetime.now().strftime('%d %b %Y, %H:%M IST')}</div>
</div></body></html>"""


# ── 1. HIGH RISK ALERT ────────────────────────────────────────────────────────

def send_high_risk_alert(
    to: str,
    vendor_name: str,
    contract_id: str,
    risk_level: str,
    situation: str,
    recommended_action: str,
    contract_value: float = 0,
    savings_potential: float = 0,
) -> bool:
    bc = "high" if risk_level == "high" else "medium"
    action = recommended_action.replace("_", " ").title()
    url = f"{settings.frontend_url}/contracts/{contract_id}"
    html = _wrap(f"""
        <span class="badge {bc}">⚠ {risk_level.upper()} RISK DETECTED</span>
        <h2>{vendor_name} Contract Flagged</h2>
        <p class="sub">{situation}</p>
        <div class="metric"><div class="lbl">Annual Value</div><div class="val">${contract_value:,.0f}</div></div>
        <div class="metric"><div class="lbl">Potential Savings</div><div class="val" style="color:#4ade80">${savings_potential:,.0f}/yr</div></div>
        <div class="metric"><div class="lbl">AI Recommendation</div><div class="val" style="font-size:16px">{action}</div></div>
        <p style="margin-top:20px">Please review and approve the AI-generated action before the notice window closes.</p>
        <a href="{url}" class="btn">Review Contract →</a>
    """)
    return _send(
        to, f"⚠️ [{risk_level.upper()} RISK] {vendor_name} needs attention",
        html, f"HIGH RISK: {vendor_name}\n{situation}\nAction: {action}\n{url}"
    )


# ── 2. APPROVAL REQUEST ───────────────────────────────────────────────────────

def send_approval_request(
    to: str,
    vendor_name: str,
    decision_id: str,
    risk_level: str,
    recommended_action: str,
    situation: str,
    root_cause: str,
    savings_annual: float = 0,
) -> bool:
    bc = "high" if risk_level == "high" else ("medium" if risk_level == "medium" else "low")
    action = recommended_action.replace("_", " ").title()
    url = f"{settings.frontend_url}/approvals"
    html = _wrap(f"""
        <span class="badge {bc}">🔔 APPROVAL REQUIRED</span>
        <h2>Decision pending your approval</h2>
        <p class="sub">The AI pipeline has analysed <strong style="color:white">{vendor_name}</strong> and needs your sign-off.</p>
        <table>
          <tr><th>Field</th><th>Detail</th></tr>
          <tr><td>Vendor</td><td style="color:white;font-weight:600">{vendor_name}</td></tr>
          <tr><td>Risk</td><td><span class="badge {bc}" style="margin:0;padding:2px 8px">{risk_level.upper()}</span></td></tr>
          <tr><td>Recommendation</td><td style="color:white;font-weight:600">{action}</td></tr>
          <tr><td>Annual Savings</td><td style="color:#4ade80;font-weight:600">${savings_annual:,.0f}</td></tr>
        </table>
        <div class="metric"><div class="lbl">Situation</div><div class="val" style="font-size:14px;font-weight:400">{situation}</div></div>
        <div class="metric"><div class="lbl">Root Cause</div><div class="val" style="font-size:14px;font-weight:400">{root_cause}</div></div>
        <a href="{url}" class="btn">Approve / Reject →</a>
    """)
    return _send(
        to, f"🔔 Approval needed: {action} for {vendor_name} (saves ${savings_annual:,.0f}/yr)",
        html, f"APPROVAL NEEDED: {vendor_name}\nAction: {action}\n{url}"
    )


# ── 3. ACTION EXECUTED CONFIRMATION ──────────────────────────────────────────

def send_action_confirmation(
    to: str,
    vendor_name: str,
    action_type: str,
    executed_by: str,
    draft_message: str,
) -> bool:
    action = action_type.replace("_", " ").title()
    preview = (draft_message[:300] + "...") if len(draft_message) > 300 else draft_message
    url = f"{settings.frontend_url}/actions"
    html = _wrap(f"""
        <span class="badge info">✅ ACTION EXECUTED</span>
        <h2>{action} sent to {vendor_name}</h2>
        <p class="sub">Approved by <strong style="color:white">{executed_by}</strong>.
        ContractLens will verify the outcome in 30 days.</p>
        <div class="metric"><div class="lbl">Action Type</div><div class="val" style="font-size:16px">{action}</div></div>
        <div class="preview">
          <div class="lbl" style="margin-bottom:8px">Message Preview</div>
          <div style="font-size:13px;color:#ccc;font-style:italic;line-height:1.6">{preview}</div>
        </div>
        <a href="{url}" class="btn">View All Actions →</a>
    """)
    return _send(
        to, f"✅ Action executed: {action} sent to {vendor_name}",
        html, f"ACTION EXECUTED: {action}\nVendor: {vendor_name}\nBy: {executed_by}"
    )


# ── 4. WEEKLY DIGEST ──────────────────────────────────────────────────────────

def send_weekly_digest(
    to: str,
    total_contracts: int,
    high_risk_count: int,
    pending_approvals: int,
    actions_taken: int,
    estimated_savings: float,
    top_risks: list,
) -> bool:
    url = f"{settings.frontend_url}/"
    rows = "".join([
        f"""<tr>
          <td style="color:white;font-weight:600">{r.get('vendor','?')}</td>
          <td><span class="badge {'high' if r.get('risk_level')=='high' else 'medium'}" style="margin:0;padding:2px 8px">{r.get('risk_level','?').upper()}</span></td>
          <td>{r.get('recommended_action','—').replace('_',' ').title()}</td>
          <td style="color:#4ade80">${r.get('contract_value_annual',0):,.0f}</td>
        </tr>""" for r in (top_risks or [])[:5]
    ]) or '<tr><td colspan="4" style="color:#555;text-align:center">No risks detected 🎉</td></tr>'

    html = _wrap(f"""
        <span class="badge info">📊 WEEKLY DIGEST</span>
        <h2>Contract Portfolio Summary</h2>
        <p class="sub">Week ending {datetime.now().strftime('%d %B %Y')}</p>
        <table style="margin:0">
          <tr>
            <td style="padding:12px;background:#12122a;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:white">{total_contracts}</div>
              <div class="lbl" style="margin-top:4px">CONTRACTS</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:12px;background:#12122a;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#f87171">{high_risk_count}</div>
              <div class="lbl" style="margin-top:4px">HIGH RISK</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:12px;background:#12122a;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#4ade80">${estimated_savings:,.0f}</div>
              <div class="lbl" style="margin-top:4px">SAVINGS FOUND</div>
            </td>
          </tr>
        </table>
        <h3 style="color:white;margin:28px 0 12px">Top Risks</h3>
        <table><tr><th>Vendor</th><th>Risk</th><th>Recommendation</th><th>Value</th></tr>{rows}</table>
        <p style="margin-top:16px;color:#aaa">
          <strong style="color:white">{pending_approvals}</strong> pending approvals ·
          <strong style="color:white">{actions_taken}</strong> actions this week
        </p>
        <a href="{url}" class="btn">Open Dashboard →</a>
    """)
    return _send(
        to, f"📊 ContractLens Weekly: {high_risk_count} high-risk · ${estimated_savings:,.0f} savings identified",
        html, f"WEEKLY DIGEST\nContracts: {total_contracts} | High Risk: {high_risk_count} | Savings: ${estimated_savings:,.0f}\n{url}"
    )

