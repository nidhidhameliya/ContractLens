"""
Termora — Agent Orchestration Service
A standalone FastAPI microservice that hosts the LangGraph pipeline
and MCP integrations.

Run: uvicorn services.agent_service.main:app --port 8001
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Termora Agent Service",
    description="LangGraph pipeline & MCP integration microservice",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Termora Agent Service"}


@app.post("/scan")
def scan_contract(payload: dict):
    """
    Accepts a contract scan request from the API Gateway and runs
    the full LangGraph pipeline synchronously, returning the decision output.
    """
    import sys
    import os
    # Ensure the backend package is importable
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

    from app.intelligence.graph import Termora_graph

    contract_id = payload.get("contract_id")
    org_id = payload.get("org_id")
    raw_text = payload.get("raw_text", "")

    initial_state = {
        "contract_id": contract_id,
        "org_id": org_id,
        "raw_text": raw_text,
        "clauses": {},
        "risk_output": {},
        "finance_output": {},
        "decision_output": {},
        "mcp_tool_calls": [],
        "requires_approval": False,
        "requires_second_approver": False,
        "route": "continue",
    }

    final_state = Termora_graph.invoke(initial_state)
    return {"status": "complete", "state": final_state}
