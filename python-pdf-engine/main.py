"""
GotuPDF - FastAPI Application

Industry-grade PDF editing API with true content stream modification.

Endpoints:
- POST /api/pdf/extract - Extract text spans from PDF
- POST /api/pdf/edit - Apply text edits
- POST /api/pdf/validate - Validate PDF quality
- POST /api/pdf/export - Export edited PDF

Copyright (c) 2024 GotuPDF
"""

import os
import io
import base64
import tempfile
import asyncio
from typing import Dict, List, Optional, Any
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
import structlog

from pdf_engine.core import (
    PDFEditingEngine,
    TextEdit,
    EditMode,
    QualityReport,
)
from pdf_engine.stream_editor import TrueContentStreamEditor

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Active PDF sessions
pdf_sessions: Dict[str, PDFEditingEngine] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting GotuPDF Engine")
    yield
    # Cleanup on shutdown
    for session_id, engine in pdf_sessions.items():
        try:
            engine.close()
        except:
            pass
    pdf_sessions.clear()
    logger.info("GotuPDF Engine shutdown complete")


app = FastAPI(
    title="GotuPDF - PDF Editing Engine",
    description="Industry-grade PDF text editing with true content stream modification",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class TextSpanResponse(BaseModel):
    """Text span extracted from PDF"""
    id: str
    text: str
    x: float
    y: float
    width: float
    height: float
    fontName: str
    fontSize: float
    fontFlags: int
    color: str  # Hex color
    transform: List[float]
    pageNumber: int
    spanIndex: int
    isEditable: bool
    isRotated: bool
    
    class Config:
        from_attributes = True


class ExtractRequest(BaseModel):
    """Request to extract text from PDF"""
    pdfBase64: str
    password: Optional[str] = None
    pageNumber: Optional[int] = None  # None = all pages


class ExtractResponse(BaseModel):
    """Response with extracted text spans"""
    success: bool
    sessionId: str
    pageCount: int
    spans: List[TextSpanResponse]
    message: Optional[str] = None


class EditRequestItem(BaseModel):
    """Single edit request"""
    spanId: str
    pageNumber: int
    originalText: str
    newText: str
    spanIndex: int
    x: float
    y: float
    fontSize: float
    fontName: str
    color: str
    mode: str = "adaptive"  # exact, adaptive, smart


class EditRequest(BaseModel):
    """Request to apply text edits"""
    sessionId: str
    edits: List[EditRequestItem]
    allowFallback: bool = True


class EditResultResponse(BaseModel):
    """Result of a single edit"""
    success: bool
    spanId: str
    message: str
    originalText: str
    newText: str
    methodUsed: str


class EditResponse(BaseModel):
    """Response with edit results"""
    success: bool
    results: List[EditResultResponse]
    qualityReport: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class ExportRequest(BaseModel):
    """Request to export PDF"""
    sessionId: str
    reencrypt: bool = True
    userPassword: Optional[str] = None
    ownerPassword: Optional[str] = None
    validateQuality: bool = True


class ExportResponse(BaseModel):
    """Response with exported PDF"""
    success: bool
    pdfBase64: Optional[str] = None
    qualityReport: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class QualityValidationRequest(BaseModel):
    """Request to validate PDF quality"""
    sessionId: str


class QualityValidationResponse(BaseModel):
    """Response with quality report"""
    success: bool
    passed: bool
    report: Dict[str, Any]


class StreamEditRequest(BaseModel):
    """Direct stream editing request (advanced)"""
    pdfBase64: str
    password: Optional[str] = None
    pageNumber: int
    spanIndex: int
    originalText: str
    newText: str


# ============================================================================
# Helper Functions
# ============================================================================

def rgb_to_hex(rgb: tuple) -> str:
    """Convert RGB tuple (0-1) to hex color"""
    r = int(rgb[0] * 255)
    g = int(rgb[1] * 255)
    b = int(rgb[2] * 255)
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple (0-1)"""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


def generate_session_id() -> str:
    """Generate unique session ID"""
    import uuid
    return str(uuid.uuid4())


def get_session(session_id: str) -> PDFEditingEngine:
    """Get PDF session or raise error"""
    if session_id not in pdf_sessions:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {session_id}"
        )
    return pdf_sessions[session_id]


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "gotupdf-engine"}


@app.post("/api/pdf/extract", response_model=ExtractResponse)
async def extract_text(request: ExtractRequest):
    """
    Extract text spans from PDF for editing.
    
    Returns all text spans with full metadata including:
    - Exact positions
    - Font information
    - Color values
    - Transformation matrices
    """
    try:
        # Decode PDF
        pdf_bytes = base64.b64decode(request.pdfBase64)
        
        # Create editing engine
        engine = PDFEditingEngine(pdf_bytes, request.password)
        
        # Generate session ID
        session_id = generate_session_id()
        pdf_sessions[session_id] = engine
        
        # Extract spans
        all_spans = []
        
        if request.pageNumber:
            pages = [request.pageNumber]
        else:
            pages = list(range(1, engine.doc.page_count + 1))
        
        for page_num in pages:
            spans = engine.extract_text_spans(page_num)
            
            for span in spans:
                all_spans.append(TextSpanResponse(
                    id=span.id,
                    text=span.text,
                    x=span.x,
                    y=span.y,
                    width=span.width,
                    height=span.height,
                    fontName=span.font_name,
                    fontSize=span.font_size,
                    fontFlags=span.font_flags,
                    color=rgb_to_hex(span.color),
                    transform=span.transform,
                    pageNumber=span.page_number,
                    spanIndex=span.span_index,
                    isEditable=span.is_editable,
                    isRotated=span.is_rotated,
                ))
        
        logger.info(
            "Text extracted",
            session_id=session_id,
            pages=len(pages),
            spans=len(all_spans)
        )
        
        return ExtractResponse(
            success=True,
            sessionId=session_id,
            pageCount=engine.doc.page_count,
            spans=all_spans,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Extract failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/api/pdf/edit", response_model=EditResponse)
async def apply_edits(request: EditRequest):
    """
    Apply text edits to PDF.
    
    Performs true in-place content stream modification.
    """
    try:
        engine = get_session(request.sessionId)
        
        # Convert edit requests to TextEdit objects
        edits = []
        for edit_item in request.edits:
            mode = EditMode(edit_item.mode) if edit_item.mode else EditMode.ADAPTIVE
            
            edits.append(TextEdit(
                span_id=edit_item.spanId,
                page_number=edit_item.pageNumber,
                original_text=edit_item.originalText,
                new_text=edit_item.newText,
                span_index=edit_item.spanIndex,
                x=edit_item.x,
                y=edit_item.y,
                font_size=edit_item.fontSize,
                font_name=edit_item.fontName,
                color=edit_item.color,
                mode=mode,
            ))
        
        # Apply edits
        results = engine.apply_edits(edits)
        
        # Convert results
        result_responses = []
        all_success = True
        
        for result in results:
            if not result.success:
                all_success = False
            
            result_responses.append(EditResultResponse(
                success=result.success,
                spanId=result.span_id,
                message=result.message,
                originalText=result.original_text,
                newText=result.new_text,
                methodUsed=result.method_used,
            ))
        
        # Validate quality if all edits succeeded
        quality_report = None
        if all_success:
            quality = engine.validate_quality()
            quality_report = {
                "passed": quality.passed,
                "objectCountBefore": quality.object_count_before,
                "objectCountAfter": quality.object_count_after,
                "imageCountBefore": quality.image_count_before,
                "imageCountAfter": quality.image_count_after,
                "dimensionsMatch": quality.dimensions_match,
                "integrityValid": quality.integrity_valid,
                "rasterizationDetected": quality.rasterization_detected,
                "layoutShiftDetected": quality.layout_shift_detected,
                "warnings": quality.warnings,
                "errors": quality.errors,
            }
        
        logger.info(
            "Edits applied",
            session_id=request.sessionId,
            edit_count=len(edits),
            success_count=sum(1 for r in results if r.success)
        )
        
        return EditResponse(
            success=all_success,
            results=result_responses,
            qualityReport=quality_report,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Edit failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Edit failed: {str(e)}")


@app.post("/api/pdf/export", response_model=ExportResponse)
async def export_pdf(request: ExportRequest):
    """
    Export the edited PDF.
    
    Options:
    - Re-encryption for originally encrypted PDFs
    - Quality validation before export
    """
    try:
        engine = get_session(request.sessionId)
        
        # Validate quality if requested
        quality_report = None
        if request.validateQuality:
            quality = engine.validate_quality()
            quality_report = {
                "passed": quality.passed,
                "objectCountBefore": quality.object_count_before,
                "objectCountAfter": quality.object_count_after,
                "imageCountBefore": quality.image_count_before,
                "imageCountAfter": quality.image_count_after,
                "dimensionsMatch": quality.dimensions_match,
                "integrityValid": quality.integrity_valid,
                "rasterizationDetected": quality.rasterization_detected,
                "layoutShiftDetected": quality.layout_shift_detected,
                "warnings": quality.warnings,
                "errors": quality.errors,
            }
            
            if not quality.passed:
                return ExportResponse(
                    success=False,
                    qualityReport=quality_report,
                    message="Quality validation failed. Export blocked to prevent document corruption."
                )
        
        # Export PDF
        pdf_bytes = engine.export(
            reencrypt=request.reencrypt,
            user_password=request.userPassword,
            owner_password=request.ownerPassword,
        )
        
        # Encode as base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('ascii')
        
        logger.info(
            "PDF exported",
            session_id=request.sessionId,
            size_kb=len(pdf_bytes) // 1024
        )
        
        return ExportResponse(
            success=True,
            pdfBase64=pdf_base64,
            qualityReport=quality_report,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Export failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.post("/api/pdf/validate", response_model=QualityValidationResponse)
async def validate_quality(request: QualityValidationRequest):
    """
    Validate PDF quality after editing.
    
    Checks:
    - Object count preservation
    - Image count (rasterization detection)
    - Page dimensions
    - PDF integrity
    """
    try:
        engine = get_session(request.sessionId)
        
        quality = engine.validate_quality()
        
        return QualityValidationResponse(
            success=True,
            passed=quality.passed,
            report={
                "objectCountBefore": quality.object_count_before,
                "objectCountAfter": quality.object_count_after,
                "pageCountBefore": quality.page_count_before,
                "pageCountAfter": quality.page_count_after,
                "imageCountBefore": quality.image_count_before,
                "imageCountAfter": quality.image_count_after,
                "fontCountBefore": quality.font_count_before,
                "fontCountAfter": quality.font_count_after,
                "dimensionsMatch": quality.dimensions_match,
                "integrityValid": quality.integrity_valid,
                "rasterizationDetected": quality.rasterization_detected,
                "layoutShiftDetected": quality.layout_shift_detected,
                "warnings": quality.warnings,
                "errors": quality.errors,
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Validation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.delete("/api/pdf/session/{session_id}")
async def close_session(session_id: str):
    """
    Close a PDF editing session and release resources.
    """
    if session_id in pdf_sessions:
        try:
            pdf_sessions[session_id].close()
        except:
            pass
        del pdf_sessions[session_id]
        return {"success": True, "message": "Session closed"}
    
    return {"success": False, "message": "Session not found"}


@app.post("/api/pdf/direct-edit")
async def direct_stream_edit(request: StreamEditRequest):
    """
    Direct content stream editing (advanced).
    
    Performs byte-level content stream manipulation
    without session management.
    """
    try:
        # Decode PDF
        pdf_bytes = base64.b64decode(request.pdfBase64)
        
        # Open document
        import fitz
        stream = io.BytesIO(pdf_bytes)
        doc = fitz.open(stream=stream, filetype="pdf")
        
        if request.password:
            doc.authenticate(request.password)
        
        # Create stream editor
        editor = TrueContentStreamEditor(doc)
        
        # Extract text operators
        page_idx = request.pageNumber - 1
        operators = editor.extract_text_operators(page_idx)
        
        # Find matching operator
        target_op = None
        for i, op in enumerate(operators):
            if (op.decoded_text == request.originalText or
                request.originalText in op.decoded_text):
                if i == request.spanIndex or target_op is None:
                    target_op = op
                    if i == request.spanIndex:
                        break
        
        if not target_op:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Text not found in content stream"
                }
            )
        
        # Replace text
        success = editor.replace_text(
            page_num=page_idx,
            text_op=target_op,
            new_text=request.newText
        )
        
        if not success:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Text replacement failed"
                }
            )
        
        # Export
        output = io.BytesIO()
        doc.save(output)
        doc.close()
        
        result_bytes = output.getvalue()
        result_base64 = base64.b64encode(result_bytes).decode('ascii')
        
        return {
            "success": True,
            "pdfBase64": result_base64,
            "message": "Direct edit applied successfully"
        }
        
    except Exception as e:
        logger.error("Direct edit failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Direct edit failed: {str(e)}")


# ============================================================================
# File Upload Endpoint
# ============================================================================

@app.post("/api/pdf/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
):
    """
    Upload PDF file and create editing session.
    
    Alternative to base64 encoding for large files.
    """
    try:
        # Read file
        contents = await file.read()
        
        if len(contents) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(
                status_code=413,
                detail="File too large. Maximum size is 50MB."
            )
        
        # Create engine
        engine = PDFEditingEngine(contents, password)
        
        # Generate session
        session_id = generate_session_id()
        pdf_sessions[session_id] = engine
        
        logger.info(
            "PDF uploaded",
            session_id=session_id,
            filename=file.filename,
            size_kb=len(contents) // 1024
        )
        
        return {
            "success": True,
            "sessionId": session_id,
            "pageCount": engine.doc.page_count,
            "filename": file.filename,
            "encrypted": engine.is_encrypted,
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Upload failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================================================
# Advanced Endpoints
# ============================================================================

@app.post("/api/pdf/compare")
async def compare_pdfs(
    original: str = Form(...),  # Base64
    edited: str = Form(...),  # Base64
):
    """
    Compare original and edited PDF for quality validation.
    
    Returns detailed diff report.
    """
    try:
        import fitz
        
        # Open both documents
        orig_bytes = base64.b64decode(original)
        edit_bytes = base64.b64decode(edited)
        
        orig_doc = fitz.open(stream=io.BytesIO(orig_bytes), filetype="pdf")
        edit_doc = fitz.open(stream=io.BytesIO(edit_bytes), filetype="pdf")
        
        comparison = {
            "pageCountMatch": orig_doc.page_count == edit_doc.page_count,
            "pageCount": {
                "original": orig_doc.page_count,
                "edited": edit_doc.page_count,
            },
            "pageDimensions": [],
            "textChanges": [],
            "imageChanges": [],
        }
        
        # Compare each page
        for i in range(min(orig_doc.page_count, edit_doc.page_count)):
            orig_page = orig_doc[i]
            edit_page = edit_doc[i]
            
            # Dimensions
            dims_match = (
                abs(orig_page.rect.width - edit_page.rect.width) < 0.01 and
                abs(orig_page.rect.height - edit_page.rect.height) < 0.01
            )
            comparison["pageDimensions"].append({
                "page": i + 1,
                "match": dims_match,
                "original": {
                    "width": orig_page.rect.width,
                    "height": orig_page.rect.height,
                },
                "edited": {
                    "width": edit_page.rect.width,
                    "height": edit_page.rect.height,
                },
            })
            
            # Image count
            orig_images = len(orig_page.get_images())
            edit_images = len(edit_page.get_images())
            
            if orig_images != edit_images:
                comparison["imageChanges"].append({
                    "page": i + 1,
                    "original": orig_images,
                    "edited": edit_images,
                    "warning": "Possible rasterization" if edit_images > orig_images else "Images removed",
                })
        
        orig_doc.close()
        edit_doc.close()
        
        return {
            "success": True,
            "comparison": comparison,
        }
        
    except Exception as e:
        logger.error("Comparison failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )
