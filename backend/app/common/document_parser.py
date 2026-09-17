"""
ContractLens — Document Parser
Converts raw file bytes (PDF/DOCX) to plain text.
Includes OCR fallback for scanned/image-based PDFs (FR-ING-4).
"""

import io
import logging
from enum import Enum

logger = logging.getLogger(__name__)

MIN_TEXT_LENGTH_FOR_VALID_EXTRACTION = 100  # Characters; below this triggers OCR fallback


class ParseFailure(Exception):
    """Raised when all parsing strategies fail for a document."""
    pass


def extract_text_from_bytes(file_bytes: bytes, file_name: str) -> str:
    """
    Master text extraction function.
    Detects file type from extension and routes to the appropriate parser.
    Raises ParseFailure if extraction is not possible (→ contract marked parse_failed).
    """
    file_lower = file_name.lower()

    if file_lower.endswith(".pdf"):
        return _extract_from_pdf(file_bytes, file_name)
    elif file_lower.endswith(".docx"):
        return _extract_from_docx(file_bytes, file_name)
    elif file_lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ParseFailure(f"Unsupported file type: {file_name}")


def _extract_from_pdf(file_bytes: bytes, file_name: str) -> str:
    """
    Attempts text extraction from a PDF.
    Falls back to OCR if extracted text is too short (scanned PDF).
    """
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()

        if len(text) >= MIN_TEXT_LENGTH_FOR_VALID_EXTRACTION:
            logger.info(f"PDF text extracted from {file_name}: {len(text)} chars")
            return text

        # Text too short — likely a scanned PDF, try OCR
        logger.info(f"PDF text extraction returned <{MIN_TEXT_LENGTH_FOR_VALID_EXTRACTION} chars for {file_name}, trying OCR")
        return _ocr_fallback(file_bytes, file_name)

    except Exception as e:
        logger.warning(f"PyPDF2 failed for {file_name}: {e}. Attempting OCR.")
        return _ocr_fallback(file_bytes, file_name)


def _extract_from_docx(file_bytes: bytes, file_name: str) -> str:
    """Extracts text from a DOCX file using python-docx."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
        if not text:
            raise ParseFailure(f"DOCX {file_name} contained no extractable text")
        logger.info(f"DOCX text extracted from {file_name}: {len(text)} chars")
        return text
    except ParseFailure:
        raise
    except Exception as e:
        raise ParseFailure(f"DOCX parsing failed for {file_name}: {e}") from e


def _ocr_fallback(file_bytes: bytes, file_name: str) -> str:
    """
    OCR fallback using pytesseract for scanned/image PDFs.
    Requires Tesseract to be installed on the system.
    """
    try:
        import pytesseract
        from PIL import Image
        import fitz  # PyMuPDF for PDF→image rendering

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages_text = []
        for page_num in range(min(len(doc), 20)):  # Limit to 20 pages for cost control
            page = doc.load_page(page_num)
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR quality
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img)
            pages_text.append(page_text)

        full_text = "\n".join(pages_text).strip()
        if not full_text:
            raise ParseFailure(f"OCR returned no text for {file_name}")

        logger.info(f"OCR extracted {len(full_text)} chars from {file_name}")
        return full_text

    except ParseFailure:
        raise
    except ImportError:
        raise ParseFailure(
            f"OCR failed for {file_name}: pytesseract or PyMuPDF not installed. "
            "Install with: pip install pytesseract pymupdf"
        )
    except Exception as e:
        raise ParseFailure(f"OCR failed for {file_name}: {e}") from e

