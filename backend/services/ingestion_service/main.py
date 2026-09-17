"""
ContractLens — Ingestion Service
A standalone FastAPI microservice that handles document parsing,
deduplication, and the periodic scan schedule. Separate from the
API Gateway so ingestion load doesn't block request handling.

Run: uvicorn services.ingestion_service.main:app --port 8002
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the ingestion scheduler
    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler()

    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from app.common.scheduler import run_ingestion_job

    scheduler.add_job(run_ingestion_job, "interval", minutes=1, id="ingestion_job", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="ContractLens Ingestion Service",
    description="Document parsing, deduplication & periodic ingestion microservice",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
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
    return {"status": "ok", "service": "ContractLens Ingestion Service"}


@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    Accepts a file upload, runs document parsing and deduplication,
    and returns the extracted raw text and metadata.
    Called by the API Gateway when a user uploads a contract.
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

    from app.common.document_parser import extract_text_from_bytes as _parse
    from app.common.deduplication import compute_hash as compute_document_hash

    contents = await file.read()

    try:
        raw_text = _parse(contents, filename=file.filename)
        doc_hash = compute_document_hash(contents)
        return {
            "filename": file.filename,
            "raw_text": raw_text,
            "document_hash": doc_hash,
            "char_count": len(raw_text),
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parse error: {e}")

