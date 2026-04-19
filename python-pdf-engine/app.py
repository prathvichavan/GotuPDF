"""
GotuPDF Enterprise PDF Editor - FastAPI Application
Full-featured REST API for PDF editing

Copyright (c) 2024 GotuPDF
"""

import asyncio
import io
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from pdf_engine.enterprise_engine import (
    EnterprisePDFEngine,
    TextEdit,
    ImageEdit,
    VectorEdit,
    EditMode,
    AlignmentType,
    AnnotationType,
    BoundingBox,
    TextSpan,
    ImageObject,
    VectorPath,
    Annotation,
    PageInfo,
    QualityReport,
    DocumentMetadata,
)

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger(__name__)

# Session storage
sessions: Dict[str, EnterprisePDFEngine] = {}
session_files: Dict[str, bytes] = {}
SESSION_TIMEOUT = 3600  # 1 hour


# =============================================================================
# Pydantic Models
# =============================================================================

class UploadResponse(BaseModel):
    session_id: str
    page_count: int
    is_encrypted: bool
    metadata: Dict[str, str]


class BoundingBoxModel(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class TextSpanModel(BaseModel):
    id: str
    text: str
    page_number: int
    x: float
    y: float
    width: float
    height: float
    font_name: str
    font_size: float
    color: str
    is_bold: bool = False
    is_italic: bool = False
    rotation: float = 0
    span_index: int = 0


class ImageObjectModel(BaseModel):
    id: str
    page_number: int
    x: float
    y: float
    width: float
    height: float
    original_width: int
    original_height: int
    dpi_x: float
    dpi_y: float
    compression: str


class VectorPathModel(BaseModel):
    id: str
    page_number: int
    bbox: BoundingBoxModel
    path_data: str
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    stroke_width: float = 1.0


class AnnotationModel(BaseModel):
    id: str
    page_number: int
    type: str
    bbox: BoundingBoxModel
    content: str = ""
    color: str = "#FFFF00"
    opacity: float = 1.0
    points: List[List[float]] = []


class PageInfoModel(BaseModel):
    number: int
    width: float
    height: float
    rotation: int
    text_count: int
    image_count: int
    vector_count: int
    annotation_count: int


class ExtractRequest(BaseModel):
    session_id: str
    page_number: int


class TextEditRequest(BaseModel):
    span_id: str
    page_number: int
    original_text: str
    new_text: str
    span_index: int = 0
    x: float
    y: float
    font_size: float
    font_name: str
    color: str = "#000000"
    mode: str = "adaptive"
    alignment: str = "left"
    preserve_width: bool = True


class ImageEditRequest(BaseModel):
    image_id: str
    page_number: int
    operation: str  # replace, resize, rotate, move
    new_width: Optional[float] = None
    new_height: Optional[float] = None
    rotation: float = 0
    new_x: Optional[float] = None
    new_y: Optional[float] = None
    maintain_aspect: bool = True


class VectorEditRequest(BaseModel):
    path_id: str
    page_number: int
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    stroke_width: Optional[float] = None


class AddAnnotationRequest(BaseModel):
    page_number: int
    type: str  # highlight, underline, strikethrough, sticky_note, freehand, text_box
    bbox: BoundingBoxModel
    content: str = ""
    color: str = "#FFFF00"
    opacity: float = 1.0
    points: List[List[float]] = []


class AddTextBoxRequest(BaseModel):
    page_number: int
    text: str
    bbox: BoundingBoxModel
    font_name: str = "Helvetica"
    font_size: float = 12
    color: str = "#000000"
    alignment: str = "left"


class AddImageRequest(BaseModel):
    page_number: int
    bbox: BoundingBoxModel
    maintain_aspect: bool = True


class AddWatermarkRequest(BaseModel):
    page_number: Optional[int] = None  # None = all pages
    text: Optional[str] = None
    opacity: float = 0.3
    rotation: float = 45


class PageOperationRequest(BaseModel):
    operation: str  # add, delete, duplicate, rotate, crop
    page_number: int
    target_position: Optional[int] = None
    rotation: Optional[int] = None
    crop_box: Optional[BoundingBoxModel] = None
    width: float = 612
    height: float = 792


class ReorderPagesRequest(BaseModel):
    new_order: List[int]


class EditBatchRequest(BaseModel):
    session_id: str
    edits: List[TextEditRequest]


class ExportOptions(BaseModel):
    linearize: bool = True
    compress: bool = True
    encrypt: bool = False
    user_password: Optional[str] = None
    owner_password: Optional[str] = None


class QualityReportModel(BaseModel):
    valid: bool
    page_count_match: bool
    dimensions_match: bool
    font_count_before: int
    font_count_after: int
    image_count_before: int
    image_count_after: int
    xref_valid: bool
    rasterization_detected: bool
    layout_shift_detected: bool
    integrity_valid: bool
    warnings: List[str]
    errors: List[str]


# =============================================================================
# Session Management
# =============================================================================

async def cleanup_old_sessions():
    """Clean up expired sessions"""
    while True:
        await asyncio.sleep(300)  # Check every 5 minutes
        current_time = time.time()
        expired = []
        
        for session_id in list(sessions.keys()):
            # Check if session is too old (would need to track timestamps)
            if session_id not in session_files:
                expired.append(session_id)
        
        for session_id in expired:
            if session_id in sessions:
                sessions[session_id].close()
                del sessions[session_id]
            if session_id in session_files:
                del session_files[session_id]
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Start cleanup task
    cleanup_task = asyncio.create_task(cleanup_old_sessions())
    
    yield
    
    # Cleanup on shutdown
    cleanup_task.cancel()
    for session_id, engine in sessions.items():
        engine.close()
    sessions.clear()
    session_files.clear()


def get_session(session_id: str) -> EnterprisePDFEngine:
    """Get a session's PDF engine"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="GotuPDF Enterprise PDF Editor",
    description="Enterprise-grade PDF editing API with true structure-level editing",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS - Allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# =============================================================================
# Document Operations
# =============================================================================

@app.post("/api/pdf/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
):
    """Upload a PDF for editing"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        pdf_data = await file.read()
        
        if len(pdf_data) > 100 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 100MB limit")
        
        session_id = str(uuid.uuid4())
        
        engine = EnterprisePDFEngine(pdf_data, password=password, session_id=session_id)
        
        sessions[session_id] = engine
        session_files[session_id] = pdf_data
        
        metadata = engine.get_metadata()
        
        return UploadResponse(
            session_id=session_id,
            page_count=engine.page_count,
            is_encrypted=engine.is_encrypted,
            metadata={
                "title": metadata.title,
                "author": metadata.author,
                "creator": metadata.creator,
                "producer": metadata.producer,
            },
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pdf/{session_id}/info")
async def get_document_info(session_id: str):
    """Get document information"""
    try:
        engine = get_session(session_id)
        
        metadata = engine.get_metadata()
        pages = engine.get_all_pages_info()
        
        return {
            "session_id": session_id,
            "page_count": engine.page_count,
            "metadata": {
                "title": metadata.title,
                "author": metadata.author,
                "subject": metadata.subject,
                "creator": metadata.creator,
            },
            "pages": [
                {
                    "number": p.number,
                    "width": p.width,
                    "height": p.height,
                    "rotation": p.rotation,
                    "text_count": p.text_count,
                    "image_count": p.image_count,
                    "annotation_count": p.annotation_count,
                }
                for p in pages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get info: {str(e)}")


# =============================================================================
# Extraction Endpoints
# =============================================================================

@app.post("/api/pdf/extract/text")
async def extract_text_spans(request: ExtractRequest):
    """Extract text spans from a page"""
    engine = get_session(request.session_id)
    
    try:
        spans = engine.extract_text_spans(request.page_number)
        page_info = engine.get_page_info(request.page_number)
        
        return {
            "spans": [
                {
                    "id": s.id,
                    "text": s.text,
                    "page_number": s.page_number,
                    "x": s.x,
                    "y": s.y,
                    "width": s.width,
                    "height": s.height,
                    "font_name": s.font_name,
                    "font_size": s.font_size,
                    "color": s.color,
                    "is_bold": s.is_bold,
                    "is_italic": s.is_italic,
                    "span_index": s.span_index,
                }
                for s in spans
            ],
            "page_width": page_info.width,
            "page_height": page_info.height,
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pdf/extract/images")
async def extract_images(request: ExtractRequest):
    """Extract images from a page"""
    engine = get_session(request.session_id)
    
    try:
        images = engine.extract_images(request.page_number)
        
        return {
            "images": [
                {
                    "id": img.id,
                    "page_number": img.page_number,
                    "x": img.bbox.x0,
                    "y": img.bbox.y0,
                    "width": img.bbox.width,
                    "height": img.bbox.height,
                    "original_width": img.width,
                    "original_height": img.height,
                    "dpi_x": img.dpi[0],
                    "dpi_y": img.dpi[1],
                    "compression": img.compression,
                }
                for img in images
            ],
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pdf/extract/vectors")
async def extract_vectors(request: ExtractRequest):
    """Extract vector paths from a page"""
    engine = get_session(request.session_id)
    
    try:
        vectors = engine.extract_vectors(request.page_number)
        
        return {
            "vectors": [
                {
                    "id": v.id,
                    "page_number": v.page_number,
                    "bbox": {
                        "x0": v.bbox.x0,
                        "y0": v.bbox.y0,
                        "x1": v.bbox.x1,
                        "y1": v.bbox.y1,
                    },
                    "path_data": v.path_data,
                    "fill_color": v.fill_color,
                    "stroke_color": v.stroke_color,
                    "stroke_width": v.stroke_width,
                }
                for v in vectors
            ],
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pdf/extract/annotations")
async def extract_annotations(request: ExtractRequest):
    """Extract annotations from a page"""
    engine = get_session(request.session_id)
    
    try:
        annotations = engine.extract_annotations(request.page_number)
        
        return {
            "annotations": [
                {
                    "id": a.id,
                    "page_number": a.page_number,
                    "type": a.type.value,
                    "bbox": {
                        "x0": a.bbox.x0,
                        "y0": a.bbox.y0,
                        "x1": a.bbox.x1,
                        "y1": a.bbox.y1,
                    },
                    "content": a.content,
                    "color": a.color,
                    "opacity": a.opacity,
                }
                for a in annotations
            ],
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pdf/extract/all")
async def extract_all(request: ExtractRequest):
    """Extract all objects from a page"""
    try:
        engine = get_session(request.session_id)
        
        spans = engine.extract_text_spans(request.page_number)
        images = engine.extract_images(request.page_number)
        vectors = engine.extract_vectors(request.page_number)
        annotations = engine.extract_annotations(request.page_number)
        page_info = engine.get_page_info(request.page_number)
        
        return {
            "page": {
                "number": page_info.number,
                "width": page_info.width,
                "height": page_info.height,
                "rotation": page_info.rotation,
            },
            "text_spans": [
                {
                    "id": s.id,
                    "text": s.text,
                    "x": s.x,
                    "y": s.y,
                    "width": s.width,
                    "height": s.height,
                    "font_name": s.font_name,
                    "font_size": s.font_size,
                    "color": s.color,
                    "is_bold": s.is_bold,
                    "is_italic": s.is_italic,
                }
                for s in spans
            ],
            "images": [
                {
                    "id": img.id,
                    "x": img.bbox.x0,
                    "y": img.bbox.y0,
                    "width": img.bbox.width,
                    "height": img.bbox.height,
                }
                for img in images
            ],
            "vectors": [
                {
                    "id": v.id,
                    "bbox": {"x0": v.bbox.x0, "y0": v.bbox.y0, "x1": v.bbox.x1, "y1": v.bbox.y1},
                    "fill_color": v.fill_color,
                    "stroke_color": v.stroke_color,
                }
                for v in vectors
            ],
            "annotations": [
                {
                    "id": a.id,
                    "type": a.type.value,
                    "bbox": {"x0": a.bbox.x0, "y0": a.bbox.y0, "x1": a.bbox.x1, "y1": a.bbox.y1},
                }
                for a in annotations
            ],
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Extract failed: {str(e)}")


# =============================================================================
# Edit Endpoints
# =============================================================================

@app.post("/api/pdf/edit/text")
async def edit_text(session_id: str = Form(...), edit: str = Form(...)):
    """Edit a text span"""
    import json
    
    engine = get_session(session_id)
    edit_data = json.loads(edit)
    
    try:
        text_edit = TextEdit(
            span_id=edit_data["span_id"],
            page_number=edit_data["page_number"],
            original_text=edit_data["original_text"],
            new_text=edit_data["new_text"],
            span_index=edit_data.get("span_index", 0),
            x=edit_data["x"],
            y=edit_data["y"],
            font_size=edit_data["font_size"],
            font_name=edit_data["font_name"],
            color=edit_data.get("color", "#000000"),
            mode=EditMode(edit_data.get("mode", "adaptive")),
            alignment=AlignmentType(edit_data.get("alignment", "left")),
            preserve_width=edit_data.get("preserve_width", True),
        )
        
        result = engine.apply_text_edit(text_edit)
        
        return {
            "success": result.success,
            "span_id": result.span_id,
            "method_used": result.method_used,
            "scale_factor": result.scale_factor,
            "error": result.error,
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pdf/edit/text/batch")
async def edit_text_batch(request: EditBatchRequest):
    """Apply multiple text edits"""
    engine = get_session(request.session_id)
    
    results = []
    
    for edit_req in request.edits:
        text_edit = TextEdit(
            span_id=edit_req.span_id,
            page_number=edit_req.page_number,
            original_text=edit_req.original_text,
            new_text=edit_req.new_text,
            span_index=edit_req.span_index,
            x=edit_req.x,
            y=edit_req.y,
            font_size=edit_req.font_size,
            font_name=edit_req.font_name,
            color=edit_req.color,
            mode=EditMode(edit_req.mode),
            alignment=AlignmentType(edit_req.alignment),
            preserve_width=edit_req.preserve_width,
        )
        
        result = engine.apply_text_edit(text_edit)
        results.append({
            "span_id": result.span_id,
            "success": result.success,
            "method_used": result.method_used,
            "error": result.error,
        })
    
    return {
        "results": results,
        "total": len(results),
        "successful": sum(1 for r in results if r["success"]),
    }


@app.post("/api/pdf/edit/image")
async def edit_image(
    session_id: str = Form(...),
    image_id: str = Form(...),
    page_number: int = Form(...),
    operation: str = Form(...),
    new_image: Optional[UploadFile] = File(None),
    new_width: Optional[float] = Form(None),
    new_height: Optional[float] = Form(None),
    rotation: float = Form(0),
    new_x: Optional[float] = Form(None),
    new_y: Optional[float] = Form(None),
):
    """Edit an image"""
    engine = get_session(session_id)
    
    new_image_data = None
    if new_image:
        new_image_data = await new_image.read()
    
    image_edit = ImageEdit(
        image_id=image_id,
        page_number=page_number,
        operation=operation,
        new_image_data=new_image_data,
        new_width=new_width,
        new_height=new_height,
        rotation=rotation,
        new_x=new_x,
        new_y=new_y,
    )
    
    result = engine.apply_image_edit(image_edit)
    
    return {
        "success": result.success,
        "image_id": result.span_id,
        "method_used": result.method_used,
        "error": result.error,
    }


# =============================================================================
# Annotation Endpoints
# =============================================================================

@app.post("/api/pdf/annotation/add")
async def add_annotation(session_id: str, request: AddAnnotationRequest):
    """Add an annotation"""
    engine = get_session(session_id)
    
    annot_type_map = {
        "highlight": AnnotationType.HIGHLIGHT,
        "underline": AnnotationType.UNDERLINE,
        "strikethrough": AnnotationType.STRIKETHROUGH,
        "sticky_note": AnnotationType.STICKY_NOTE,
        "freehand": AnnotationType.FREEHAND,
        "text_box": AnnotationType.TEXT_BOX,
    }
    
    annot_type = annot_type_map.get(request.type.lower())
    if not annot_type:
        raise HTTPException(status_code=400, detail=f"Invalid annotation type: {request.type}")
    
    bbox = BoundingBox(
        request.bbox.x0,
        request.bbox.y0,
        request.bbox.x1,
        request.bbox.y1,
    )
    
    points = [(p[0], p[1]) for p in request.points] if request.points else None
    
    annotation = engine.add_annotation(
        page_number=request.page_number,
        annot_type=annot_type,
        bbox=bbox,
        content=request.content,
        color=request.color,
        opacity=request.opacity,
        points=points,
    )
    
    if annotation:
        return {
            "success": True,
            "annotation_id": annotation.id,
        }
    else:
        raise HTTPException(status_code=400, detail="Failed to add annotation")


@app.delete("/api/pdf/annotation/{session_id}/{page_number}/{annot_id}")
async def delete_annotation(session_id: str, page_number: int, annot_id: str):
    """Delete an annotation"""
    engine = get_session(session_id)
    
    success = engine.delete_annotation(page_number, annot_id)
    
    return {"success": success}


# =============================================================================
# Add Elements Endpoints
# =============================================================================

@app.post("/api/pdf/add/textbox")
async def add_text_box(session_id: str, request: AddTextBoxRequest):
    """Add a text box"""
    engine = get_session(session_id)
    
    bbox = BoundingBox(
        request.bbox.x0,
        request.bbox.y0,
        request.bbox.x1,
        request.bbox.y1,
    )
    
    alignment_map = {
        "left": AlignmentType.LEFT,
        "center": AlignmentType.CENTER,
        "right": AlignmentType.RIGHT,
        "justify": AlignmentType.JUSTIFY,
    }
    
    text_id = engine.add_text_box(
        page_number=request.page_number,
        text=request.text,
        bbox=bbox,
        font_name=request.font_name,
        font_size=request.font_size,
        color=request.color,
        alignment=alignment_map.get(request.alignment, AlignmentType.LEFT),
    )
    
    return {"success": True, "text_id": text_id}


@app.post("/api/pdf/add/image")
async def add_image(
    session_id: str = Form(...),
    page_number: int = Form(...),
    x0: float = Form(...),
    y0: float = Form(...),
    x1: float = Form(...),
    y1: float = Form(...),
    image: UploadFile = File(...),
    maintain_aspect: bool = Form(True),
):
    """Add an image"""
    engine = get_session(session_id)
    
    image_data = await image.read()
    bbox = BoundingBox(x0, y0, x1, y1)
    
    image_id = engine.add_image(
        page_number=page_number,
        image_data=image_data,
        bbox=bbox,
        maintain_aspect=maintain_aspect,
    )
    
    return {"success": True, "image_id": image_id}


@app.post("/api/pdf/add/watermark")
async def add_watermark(
    session_id: str = Form(...),
    page_number: Optional[int] = Form(None),
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    opacity: float = Form(0.3),
    rotation: float = Form(45),
):
    """Add a watermark"""
    engine = get_session(session_id)
    
    image_data = None
    if image:
        image_data = await image.read()
    
    if page_number:
        success = engine.add_watermark(
            page_number=page_number,
            text=text,
            image_data=image_data,
            opacity=opacity,
            rotation=rotation,
        )
    else:
        success = engine.add_watermark_to_all_pages(
            text=text,
            image_data=image_data,
            opacity=opacity,
            rotation=rotation,
        )
    
    return {"success": success}


# =============================================================================
# Page Operations
# =============================================================================

@app.post("/api/pdf/page/operation")
async def page_operation(session_id: str, request: PageOperationRequest):
    """Perform page operation"""
    engine = get_session(session_id)
    
    result = {"success": False}
    
    if request.operation == "add":
        new_page = engine.add_page(
            width=request.width,
            height=request.height,
            position=request.target_position or -1,
        )
        result = {"success": True, "new_page_number": new_page}
        
    elif request.operation == "delete":
        success = engine.delete_page(request.page_number)
        result = {"success": success}
        
    elif request.operation == "duplicate":
        new_page = engine.duplicate_page(
            request.page_number,
            request.target_position or -1,
        )
        result = {"success": True, "new_page_number": new_page}
        
    elif request.operation == "rotate":
        if request.rotation is None:
            raise HTTPException(status_code=400, detail="Rotation value required")
        success = engine.rotate_page(request.page_number, request.rotation)
        result = {"success": success}
        
    elif request.operation == "crop":
        if not request.crop_box:
            raise HTTPException(status_code=400, detail="Crop box required")
        bbox = BoundingBox(
            request.crop_box.x0,
            request.crop_box.y0,
            request.crop_box.x1,
            request.crop_box.y1,
        )
        success = engine.crop_page(request.page_number, bbox)
        result = {"success": success}
    
    result["page_count"] = engine.page_count
    return result


@app.post("/api/pdf/page/reorder")
async def reorder_pages(session_id: str, request: ReorderPagesRequest):
    """Reorder pages"""
    engine = get_session(session_id)
    
    success = engine.reorder_pages(request.new_order)
    
    return {"success": success, "page_count": engine.page_count}


# =============================================================================
# Undo/Redo
# =============================================================================

@app.post("/api/pdf/{session_id}/undo")
async def undo(session_id: str):
    """Undo last edit"""
    engine = get_session(session_id)
    success = engine.undo()
    return {"success": success}


@app.post("/api/pdf/{session_id}/redo")
async def redo(session_id: str):
    """Redo last undone edit"""
    engine = get_session(session_id)
    success = engine.redo()
    return {"success": success}


# =============================================================================
# Rendering
# =============================================================================

@app.get("/api/pdf/{session_id}/render/{page_number}")
async def render_page(session_id: str, page_number: int, scale: float = 1.5):
    """Render a page as PNG"""
    engine = get_session(session_id)
    
    try:
        png_data = engine.render_page(page_number, scale)
        return Response(content=png_data, media_type="image/png")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/pdf/{session_id}/thumbnail/{page_number}")
async def get_thumbnail(session_id: str, page_number: int, width: int = 150):
    """Get page thumbnail"""
    engine = get_session(session_id)
    
    try:
        png_data = engine.render_page_thumbnail(page_number, width)
        return Response(content=png_data, media_type="image/png")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Quality & Export
# =============================================================================

@app.get("/api/pdf/{session_id}/validate")
async def validate_quality(session_id: str):
    """Validate document quality"""
    engine = get_session(session_id)
    
    report = engine.validate_quality()
    
    return {
        "valid": report.valid,
        "page_count_match": report.page_count_match,
        "dimensions_match": report.dimensions_match,
        "font_count_before": report.font_count_before,
        "font_count_after": report.font_count_after,
        "image_count_before": report.image_count_before,
        "image_count_after": report.image_count_after,
        "xref_valid": report.xref_valid,
        "rasterization_detected": report.rasterization_detected,
        "layout_shift_detected": report.layout_shift_detected,
        "integrity_valid": report.integrity_valid,
        "warnings": report.warnings,
        "errors": report.errors,
    }


class ExportRequest(BaseModel):
    """Export request with session_id in body"""
    session_id: str
    linearize: bool = True
    compress: bool = True
    encrypt: bool = False
    user_password: Optional[str] = None
    owner_password: Optional[str] = None


@app.post("/api/pdf/export")
async def export_pdf_simple(request: ExportRequest):
    """
    Export the edited PDF (structure-preserving).
    
    IMPORTANT: This export preserves the full PDF structure:
    - All images remain intact
    - All vector graphics remain intact
    - All backgrounds remain intact
    - All tables remain intact
    - Only modified text is changed (via overlay)
    """
    engine = get_session(request.session_id)
    
    # Validate first
    quality = engine.validate_quality()
    if not quality.valid:
        logger.warning(f"Quality issues detected: {quality.errors}")
    
    pdf_bytes = engine.export(
        linearize=request.linearize,
        compress=request.compress,
        encrypt=request.encrypt,
        user_password=request.user_password,
        owner_password=request.owner_password,
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=edited_{request.session_id[:8]}.pdf",
            "X-Quality-Valid": str(quality.valid).lower(),
        },
    )


@app.post("/api/pdf/{session_id}/export")
async def export_pdf(session_id: str, options: ExportOptions):
    """Export the edited PDF"""
    engine = get_session(session_id)
    
    # Validate first
    quality = engine.validate_quality()
    if not quality.valid:
        logger.warning(f"Quality issues detected: {quality.errors}")
    
    pdf_bytes = engine.export(
        linearize=options.linearize,
        compress=options.compress,
        encrypt=options.encrypt,
        user_password=options.user_password,
        owner_password=options.owner_password,
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=edited_{session_id[:8]}.pdf",
            "X-Quality-Valid": str(quality.valid).lower(),
        },
    )


@app.delete("/api/pdf/{session_id}")
async def close_session(session_id: str):
    """Close a session and cleanup"""
    if session_id in sessions:
        sessions[session_id].close()
        del sessions[session_id]
    if session_id in session_files:
        del session_files[session_id]
    
    return {"success": True}


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "active_sessions": len(sessions),
        "version": "2.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
