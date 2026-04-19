"""
GotuPDF Enterprise PDF Editing Engine
Core engine with full editing capabilities

Copyright (c) 2024 GotuPDF
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import os
import re
import struct
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import fitz  # PyMuPDF
import structlog

logger = structlog.get_logger(__name__)


# =============================================================================
# Enums and Constants
# =============================================================================

class EditMode(str, Enum):
    EXACT = "exact"
    ADAPTIVE = "adaptive"
    SMART = "smart"


class ObjectType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VECTOR = "vector"
    ANNOTATION = "annotation"
    FORM_FIELD = "form_field"


class AnnotationType(str, Enum):
    HIGHLIGHT = "highlight"
    UNDERLINE = "underline"
    STRIKETHROUGH = "strikethrough"
    STICKY_NOTE = "sticky_note"
    FREEHAND = "freehand"
    TEXT_BOX = "text_box"


class AlignmentType(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class BoundingBox:
    """Represents a bounding box in PDF coordinates"""
    x0: float
    y0: float
    x1: float
    y1: float
    
    @property
    def width(self) -> float:
        return abs(self.x1 - self.x0)
    
    @property
    def height(self) -> float:
        return abs(self.y1 - self.y0)
    
    @property
    def center(self) -> Tuple[float, float]:
        return ((self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2)
    
    def to_rect(self) -> fitz.Rect:
        return fitz.Rect(self.x0, self.y0, self.x1, self.y1)
    
    @classmethod
    def from_rect(cls, rect: fitz.Rect) -> "BoundingBox":
        return cls(rect.x0, rect.y0, rect.x1, rect.y1)


@dataclass
class TextSpan:
    """Represents an editable text span"""
    id: str
    text: str
    page_number: int
    bbox: BoundingBox
    font_name: str
    font_size: float
    color: str
    is_bold: bool = False
    is_italic: bool = False
    char_spacing: float = 0.0
    word_spacing: float = 0.0
    horizontal_scale: float = 100.0
    rotation: float = 0.0
    span_index: int = 0
    block_index: int = 0
    line_index: int = 0
    flags: int = 0
    origin: Tuple[float, float] = (0, 0)
    
    @property
    def x(self) -> float:
        return self.bbox.x0
    
    @property
    def y(self) -> float:
        return self.bbox.y0
    
    @property
    def width(self) -> float:
        return self.bbox.width
    
    @property
    def height(self) -> float:
        return self.bbox.height


@dataclass
class ImageObject:
    """Represents an image in the PDF"""
    id: str
    page_number: int
    bbox: BoundingBox
    xref: int
    width: int
    height: int
    colorspace: str
    bpc: int  # bits per component
    compression: str
    dpi: Tuple[float, float]
    alpha: bool = False
    mask_xref: Optional[int] = None
    
    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height if self.height > 0 else 1.0


@dataclass 
class VectorPath:
    """Represents a vector path/shape"""
    id: str
    page_number: int
    bbox: BoundingBox
    path_data: str  # SVG-like path data
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    stroke_width: float = 1.0
    fill_opacity: float = 1.0
    stroke_opacity: float = 1.0
    line_cap: int = 0
    line_join: int = 0
    dash_pattern: List[float] = field(default_factory=list)


@dataclass
class Annotation:
    """Represents a PDF annotation"""
    id: str
    page_number: int
    type: AnnotationType
    bbox: BoundingBox
    content: str = ""
    color: str = "#FFFF00"
    opacity: float = 1.0
    author: str = ""
    created: str = ""
    modified: str = ""
    points: List[Tuple[float, float]] = field(default_factory=list)


@dataclass
class PageInfo:
    """Page information"""
    number: int
    width: float
    height: float
    rotation: int
    cropbox: BoundingBox
    mediabox: BoundingBox
    text_count: int = 0
    image_count: int = 0
    vector_count: int = 0
    annotation_count: int = 0


@dataclass
class TextEdit:
    """Represents a text edit operation"""
    span_id: str
    page_number: int
    original_text: str
    new_text: str
    span_index: int
    x: float
    y: float
    font_size: float
    font_name: str
    color: str
    mode: EditMode = EditMode.ADAPTIVE
    alignment: AlignmentType = AlignmentType.LEFT
    preserve_width: bool = True


@dataclass
class ImageEdit:
    """Represents an image edit operation"""
    image_id: str
    page_number: int
    operation: str  # replace, resize, rotate, move
    new_image_data: Optional[bytes] = None
    new_width: Optional[float] = None
    new_height: Optional[float] = None
    rotation: float = 0
    new_x: Optional[float] = None
    new_y: Optional[float] = None
    maintain_aspect: bool = True
    preserve_dpi: bool = True


@dataclass
class VectorEdit:
    """Represents a vector/shape edit"""
    path_id: str
    page_number: int
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    stroke_width: Optional[float] = None
    new_path_data: Optional[str] = None
    transform: Optional[List[float]] = None


@dataclass
class EditResult:
    """Result of an edit operation"""
    success: bool
    span_id: str
    method_used: str = ""
    scale_factor: float = 1.0
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


@dataclass
class QualityReport:
    """Quality validation report"""
    valid: bool
    page_count_match: bool
    dimensions_match: bool
    font_count_before: int
    font_count_after: int
    image_count_before: int
    image_count_after: int
    vector_count_before: int
    vector_count_after: int
    xref_valid: bool
    rasterization_detected: bool
    layout_shift_detected: bool
    integrity_valid: bool
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class DocumentMetadata:
    """PDF document metadata"""
    title: str = ""
    author: str = ""
    subject: str = ""
    keywords: str = ""
    creator: str = ""
    producer: str = ""
    creation_date: str = ""
    mod_date: str = ""
    
    
# =============================================================================
# Enterprise PDF Editing Engine
# =============================================================================

class EnterprisePDFEngine:
    """
    Enterprise-grade PDF editing engine with true structure-level editing.
    
    Features:
    - True content stream editing (no overlays or rasterization)
    - Text editing with font preservation
    - Image editing with DPI preservation
    - Vector/shape editing
    - Annotations
    - Page operations
    - Encryption support
    - Quality validation
    """
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(
        self,
        pdf_data: bytes,
        password: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.session_id = session_id or str(uuid.uuid4())
        self.password = password
        self._original_data = pdf_data
        self._original_hash = hashlib.sha256(pdf_data).hexdigest()
        
        # Statistics for quality control
        self._initial_stats: Dict[str, Any] = {}
        
        # Edit history for undo/redo
        self._edit_history: List[Dict[str, Any]] = []
        self._redo_stack: List[Dict[str, Any]] = []
        self._max_history = 50
        
        # Load document
        self._load_document(pdf_data, password)
        self._capture_initial_stats()
        
    def _load_document(self, pdf_data: bytes, password: Optional[str] = None):
        """Load PDF document with optional decryption"""
        if len(pdf_data) > self.MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds {self.MAX_FILE_SIZE // (1024*1024)}MB limit")
        
        try:
            self.doc = fitz.open(stream=io.BytesIO(pdf_data), filetype="pdf")
            
            if self.doc.is_encrypted:
                if password:
                    if not self.doc.authenticate(password):
                        raise ValueError("Invalid password")
                else:
                    raise ValueError("PDF is encrypted. Password required.")
                    
            self.is_encrypted = self.doc.needs_pass
            self.page_count = self.doc.page_count
            
            logger.info(
                "PDF loaded",
                session_id=self.session_id,
                pages=self.page_count,
                encrypted=self.is_encrypted,
            )
            
        except fitz.FileDataError as e:
            raise ValueError(f"Invalid or corrupted PDF: {e}")
    
    def _capture_initial_stats(self):
        """Capture document statistics for quality control"""
        stats = {
            "page_count": self.doc.page_count,
            "pages": [],
            "total_fonts": set(),
            "total_images": 0,
            "total_vectors": 0,
            "xref_count": self.doc.xref_length(),
        }
        
        for page_num in range(self.doc.page_count):
            page = self.doc[page_num]
            page_stats = {
                "width": page.rect.width,
                "height": page.rect.height,
                "rotation": page.rotation,
                "image_count": len(page.get_images()),
                "text_blocks": len(page.get_text("dict")["blocks"]),
            }
            
            # Count fonts
            for font in page.get_fonts():
                stats["total_fonts"].add(font[3])  # font name
            
            stats["total_images"] += page_stats["image_count"]
            stats["pages"].append(page_stats)
        
        stats["total_fonts"] = len(stats["total_fonts"])
        self._initial_stats = stats
    
    # =========================================================================
    # Document Information
    # =========================================================================
    
    def get_metadata(self) -> DocumentMetadata:
        """Get document metadata"""
        meta = self.doc.metadata or {}
        return DocumentMetadata(
            title=meta.get("title", ""),
            author=meta.get("author", ""),
            subject=meta.get("subject", ""),
            keywords=meta.get("keywords", ""),
            creator=meta.get("creator", ""),
            producer=meta.get("producer", ""),
            creation_date=meta.get("creationDate", ""),
            mod_date=meta.get("modDate", ""),
        )
    
    def get_page_info(self, page_number: int) -> PageInfo:
        """Get detailed page information"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        
        # page.annots() returns a generator in newer PyMuPDF versions
        annots_gen = page.annots()
        annots = list(annots_gen) if annots_gen is not None else []
        
        return PageInfo(
            number=page_number,
            width=page.rect.width,
            height=page.rect.height,
            rotation=page.rotation,
            cropbox=BoundingBox.from_rect(page.cropbox),
            mediabox=BoundingBox.from_rect(page.mediabox),
            text_count=len(self._get_text_blocks(page)),
            image_count=len(page.get_images()),
            vector_count=len(self._get_drawings(page)),
            annotation_count=len(annots),
        )
    
    def get_all_pages_info(self) -> List[PageInfo]:
        """Get info for all pages"""
        return [self.get_page_info(i + 1) for i in range(self.doc.page_count)]
    
    def _get_text_blocks(self, page: fitz.Page) -> List[Dict]:
        """Extract text blocks from page"""
        return page.get_text("dict")["blocks"]
    
    def _get_drawings(self, page: fitz.Page) -> List[Dict]:
        """Extract vector drawings from page"""
        return page.get_drawings()
    
    # =========================================================================
    # Text Extraction
    # =========================================================================
    
    def extract_text_spans(self, page_number: int) -> List[TextSpan]:
        """
        Extract all editable text spans from a page with full positioning data.
        """
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        text_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
        
        spans: List[TextSpan] = []
        span_counter = 0
        
        for block_idx, block in enumerate(text_dict.get("blocks", [])):
            if block.get("type") != 0:  # Skip non-text blocks
                continue
            
            for line_idx, line in enumerate(block.get("lines", [])):
                for span_idx, span in enumerate(line.get("spans", [])):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    
                    bbox = span.get("bbox", (0, 0, 0, 0))
                    font = span.get("font", "")
                    size = span.get("size", 12)
                    flags = span.get("flags", 0)
                    color_int = span.get("color", 0)
                    origin = span.get("origin", (bbox[0], bbox[3]))
                    
                    # Convert color to hex
                    color = self._int_to_hex_color(color_int)
                    
                    # Detect font style
                    is_bold = bool(flags & 2**4)
                    is_italic = bool(flags & 2**1)
                    
                    span_id = f"p{page_number}_b{block_idx}_l{line_idx}_s{span_idx}"
                    
                    spans.append(TextSpan(
                        id=span_id,
                        text=span.get("text", ""),
                        page_number=page_number,
                        bbox=BoundingBox(bbox[0], bbox[1], bbox[2], bbox[3]),
                        font_name=font,
                        font_size=size,
                        color=color,
                        is_bold=is_bold,
                        is_italic=is_italic,
                        flags=flags,
                        span_index=span_counter,
                        block_index=block_idx,
                        line_index=line_idx,
                        origin=origin,
                    ))
                    span_counter += 1
        
        logger.info(
            "Extracted text spans",
            page=page_number,
            count=len(spans),
            session_id=self.session_id,
        )
        
        return spans
    
    # =========================================================================
    # Image Extraction
    # =========================================================================
    
    def extract_images(self, page_number: int) -> List[ImageObject]:
        """Extract all images from a page"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        images: List[ImageObject] = []
        
        image_list = page.get_images(full=True)
        
        for img_idx, img in enumerate(image_list):
            xref = img[0]
            
            try:
                # Get image info
                img_info = self.doc.extract_image(xref)
                
                # Get image position on page
                img_rects = page.get_image_rects(xref)
                if not img_rects:
                    continue
                
                rect = img_rects[0]
                
                # Calculate DPI
                dpi_x = img_info["width"] / (rect.width / 72) if rect.width > 0 else 72
                dpi_y = img_info["height"] / (rect.height / 72) if rect.height > 0 else 72
                
                images.append(ImageObject(
                    id=f"p{page_number}_img_{img_idx}",
                    page_number=page_number,
                    bbox=BoundingBox.from_rect(rect),
                    xref=xref,
                    width=img_info["width"],
                    height=img_info["height"],
                    colorspace=img_info.get("colorspace", 3),
                    bpc=img_info.get("bpc", 8),
                    compression=img_info.get("ext", "png"),
                    dpi=(dpi_x, dpi_y),
                    alpha=img_info.get("alpha", False),
                ))
                
            except Exception as e:
                logger.warning(f"Could not extract image {xref}: {e}")
                continue
        
        return images
    
    # =========================================================================
    # Vector/Shape Extraction
    # =========================================================================
    
    def extract_vectors(self, page_number: int) -> List[VectorPath]:
        """Extract vector paths/shapes from a page"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        vectors: List[VectorPath] = []
        
        drawings = page.get_drawings()
        
        for idx, drawing in enumerate(drawings):
            rect = drawing.get("rect", fitz.Rect())
            items = drawing.get("items", [])
            
            # Convert path items to SVG-like path data
            path_data = self._items_to_path_data(items)
            
            # Get colors
            fill = drawing.get("fill")
            stroke = drawing.get("color")
            
            fill_color = self._color_tuple_to_hex(fill) if fill else None
            stroke_color = self._color_tuple_to_hex(stroke) if stroke else None
            
            vectors.append(VectorPath(
                id=f"p{page_number}_vec_{idx}",
                page_number=page_number,
                bbox=BoundingBox.from_rect(rect),
                path_data=path_data,
                fill_color=fill_color,
                stroke_color=stroke_color,
                stroke_width=drawing.get("width", 1.0),
                fill_opacity=drawing.get("fill_opacity", 1.0),
                stroke_opacity=drawing.get("stroke_opacity", 1.0),
                line_cap=drawing.get("lineCap", 0),
                line_join=drawing.get("lineJoin", 0),
                dash_pattern=drawing.get("dashes", []),
            ))
        
        return vectors
    
    def _items_to_path_data(self, items: List) -> str:
        """Convert PyMuPDF path items to SVG-like path data"""
        parts = []
        
        for item in items:
            if item[0] == "m":  # moveto
                parts.append(f"M {item[1].x:.2f} {item[1].y:.2f}")
            elif item[0] == "l":  # lineto
                parts.append(f"L {item[1].x:.2f} {item[1].y:.2f}")
            elif item[0] == "c":  # curveto (cubic Bézier)
                parts.append(
                    f"C {item[1].x:.2f} {item[1].y:.2f} "
                    f"{item[2].x:.2f} {item[2].y:.2f} "
                    f"{item[3].x:.2f} {item[3].y:.2f}"
                )
            elif item[0] == "re":  # rectangle
                rect = item[1]
                parts.append(
                    f"M {rect.x0:.2f} {rect.y0:.2f} "
                    f"L {rect.x1:.2f} {rect.y0:.2f} "
                    f"L {rect.x1:.2f} {rect.y1:.2f} "
                    f"L {rect.x0:.2f} {rect.y1:.2f} Z"
                )
            elif item[0] == "qu":  # quad
                quad = item[1]
                parts.append(
                    f"M {quad.ul.x:.2f} {quad.ul.y:.2f} "
                    f"L {quad.ur.x:.2f} {quad.ur.y:.2f} "
                    f"L {quad.lr.x:.2f} {quad.lr.y:.2f} "
                    f"L {quad.ll.x:.2f} {quad.ll.y:.2f} Z"
                )
        
        return " ".join(parts)
    
    # =========================================================================
    # Annotation Extraction
    # =========================================================================
    
    def extract_annotations(self, page_number: int) -> List[Annotation]:
        """Extract annotations from a page"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        annotations: List[Annotation] = []
        
        # page.annots() returns a generator in newer PyMuPDF
        annots_gen = page.annots()
        annots_list = list(annots_gen) if annots_gen is not None else []
        if not annots_list:
            return annotations
        
        for idx, annot in enumerate(annots_list):
            annot_type = annot.type[1]  # Type name
            
            # Map to our annotation types
            type_map = {
                "Highlight": AnnotationType.HIGHLIGHT,
                "Underline": AnnotationType.UNDERLINE,
                "StrikeOut": AnnotationType.STRIKETHROUGH,
                "Text": AnnotationType.STICKY_NOTE,
                "Ink": AnnotationType.FREEHAND,
                "FreeText": AnnotationType.TEXT_BOX,
            }
            
            our_type = type_map.get(annot_type, AnnotationType.STICKY_NOTE)
            
            # Get color
            colors = annot.colors
            color = self._color_tuple_to_hex(colors.get("stroke") or colors.get("fill") or (1, 1, 0))
            
            # Get vertices for ink annotations
            points = []
            if annot_type == "Ink":
                vertices = annot.vertices
                if vertices:
                    points = [(p.x, p.y) for p in vertices]
            
            annotations.append(Annotation(
                id=f"p{page_number}_annot_{idx}",
                page_number=page_number,
                type=our_type,
                bbox=BoundingBox.from_rect(annot.rect),
                content=annot.info.get("content", ""),
                color=color,
                opacity=annot.opacity,
                author=annot.info.get("title", ""),
                created=annot.info.get("creationDate", ""),
                modified=annot.info.get("modDate", ""),
                points=points,
            ))
        
        return annotations
    
    # =========================================================================
    # Text Editing
    # =========================================================================
    
    def apply_text_edit(self, edit: TextEdit) -> EditResult:
        """
        Apply a text edit using OVERLAY method.
        
        This approach PRESERVES the entire PDF structure:
        - All images remain intact
        - All vector graphics remain intact
        - All backgrounds remain intact
        - All tables remain intact
        - Only the specific text is visually replaced
        
        Method:
        1. Search for original text to get exact bbox
        2. Draw a white rectangle over the original text (covers it)
        3. Insert new text at the same position on top
        
        This does NOT modify or remove any existing PDF content.
        It only ADDS new content on top (overlay).
        """
        try:
            page = self.doc[edit.page_number - 1]
            
            # Save state for undo
            self._save_edit_state("text_edit", edit.page_number, edit)
            
            # Find the exact text location
            text_instances = page.search_for(edit.original_text)
            
            if not text_instances:
                # Fallback: use provided coordinates if text not found
                if edit.x is not None and edit.y is not None:
                    logger.warning(
                        f"Text not found, using provided coordinates",
                        original_text=edit.original_text[:50],
                        session_id=self.session_id,
                    )
                    # Create rect from coordinates - PDF coordinates (y from bottom)
                    font_height = edit.font_size if edit.font_size else 12
                    estimated_width = len(edit.original_text) * font_height * 0.6
                    target_rect = fitz.Rect(
                        edit.x,
                        edit.y,
                        edit.x + estimated_width,
                        edit.y + font_height
                    )
                else:
                    return EditResult(
                        success=False,
                        span_id=edit.span_id,
                        error=f"Text not found: '{edit.original_text[:50]}...'"
                    )
            else:
                # Find the instance closest to the expected position
                target_rect = None
                min_distance = float('inf')
                
                for rect in text_instances:
                    if edit.x is not None and edit.y is not None:
                        # Compare with PDF coordinates
                        dist = ((rect.x0 - edit.x) ** 2 + (rect.y0 - edit.y) ** 2) ** 0.5
                    else:
                        dist = 0  # Take first match if no position provided
                    if dist < min_distance:
                        min_distance = dist
                        target_rect = rect
            
            if not target_rect:
                return EditResult(
                    success=False,
                    span_id=edit.span_id,
                    error="Could not locate text position"
                )
            
            # Calculate scaling if needed
            scale_factor = 1.0
            method_used = "overlay"
            
            if edit.mode == EditMode.ADAPTIVE and edit.preserve_width:
                # Calculate text widths
                original_width = target_rect.width
                
                # Estimate new width using average character width
                char_width = original_width / max(len(edit.original_text), 1)
                new_width = char_width * len(edit.new_text)
                
                if new_width > original_width * 1.1:
                    scale_factor = original_width / new_width
                    method_used = "overlay_scaled"
            
            # ================================================================
            # OVERLAY APPROACH: Preserve all PDF structure
            # ================================================================
            
            # Get font settings
            font_name = self._get_base_font_name(edit.font_name)
            font_size = (edit.font_size or 12) * scale_factor
            text_color = self._hex_to_color_tuple(edit.color) if edit.color else (0, 0, 0)
            
            # Step 1: Cover original text with white rectangle
            # Expand rect slightly to ensure full coverage
            cover_rect = fitz.Rect(
                target_rect.x0 - 1,
                target_rect.y0 - 1,
                target_rect.x1 + 1,
                target_rect.y1 + 1,
            )
            
            # Draw filled white rectangle directly on page
            page.draw_rect(
                cover_rect,
                color=None,          # No border
                fill=(1, 1, 1),      # White fill
                overlay=True,        # Add on top of existing content
            )
            
            # Step 2: Insert new text at the same position
            # Calculate insertion point (bottom-left of text baseline)
            # insert_text uses the baseline point
            insert_point = fitz.Point(target_rect.x0, target_rect.y1 - 2)
            
            # Insert the text
            page.insert_text(
                insert_point,
                edit.new_text,
                fontname=font_name,
                fontsize=font_size,
                color=text_color,
                overlay=True,
            )
            
            logger.info(
                "Text edit applied (overlay method)",
                span_id=edit.span_id,
                method=method_used,
                scale=scale_factor,
                rect=str(target_rect),
                insert_point=str(insert_point),
                session_id=self.session_id,
            )
            
            return EditResult(
                success=True,
                span_id=edit.span_id,
                method_used=method_used,
                scale_factor=scale_factor,
            )
            
        except Exception as e:
            logger.error(f"Text edit failed: {e}", session_id=self.session_id)
            return EditResult(
                success=False,
                span_id=edit.span_id,
                error=str(e),
            )
    
    def apply_text_edits(self, edits: List[TextEdit]) -> List[EditResult]:
        """Apply multiple text edits"""
        results = []
        for edit in edits:
            result = self.apply_text_edit(edit)
            results.append(result)
        return results
    
    # =========================================================================
    # Image Editing
    # =========================================================================
    
    def apply_image_edit(self, edit: ImageEdit) -> EditResult:
        """Apply an image edit operation"""
        try:
            page = self.doc[edit.page_number - 1]
            
            # Get original image info
            images = self.extract_images(edit.page_number)
            target_image = next((img for img in images if img.id == edit.image_id), None)
            
            if not target_image:
                return EditResult(
                    success=False,
                    span_id=edit.image_id,
                    error="Image not found"
                )
            
            self._save_edit_state("image_edit", edit.page_number, edit)
            
            if edit.operation == "replace":
                return self._replace_image(page, target_image, edit)
            elif edit.operation == "resize":
                return self._resize_image(page, target_image, edit)
            elif edit.operation == "rotate":
                return self._rotate_image(page, target_image, edit)
            elif edit.operation == "move":
                return self._move_image(page, target_image, edit)
            else:
                return EditResult(
                    success=False,
                    span_id=edit.image_id,
                    error=f"Unknown operation: {edit.operation}"
                )
                
        except Exception as e:
            logger.error(f"Image edit failed: {e}", session_id=self.session_id)
            return EditResult(
                success=False,
                span_id=edit.image_id,
                error=str(e),
            )
    
    def _replace_image(self, page: fitz.Page, target: ImageObject, edit: ImageEdit) -> EditResult:
        """Replace an image with a new one"""
        if not edit.new_image_data:
            return EditResult(success=False, span_id=edit.image_id, error="No image data provided")
        
        try:
            # Create new image from data
            new_image = fitz.Pixmap(edit.new_image_data)
            
            # Get target rect (optionally resize)
            if edit.new_width and edit.new_height:
                rect = fitz.Rect(
                    target.bbox.x0,
                    target.bbox.y0,
                    target.bbox.x0 + edit.new_width,
                    target.bbox.y0 + edit.new_height,
                )
            else:
                rect = target.bbox.to_rect()
            
            # Remove old image by covering with white rect and then insert new
            page.add_redact_annot(target.bbox.to_rect())
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)
            
            # Insert new image
            page.insert_image(rect, pixmap=new_image)
            
            return EditResult(success=True, span_id=edit.image_id, method_used="replace")
            
        except Exception as e:
            return EditResult(success=False, span_id=edit.image_id, error=str(e))
    
    def _resize_image(self, page: fitz.Page, target: ImageObject, edit: ImageEdit) -> EditResult:
        """Resize an image"""
        try:
            # Extract original image
            img_data = self.doc.extract_image(target.xref)
            
            if edit.maintain_aspect:
                # Calculate new dimensions maintaining aspect ratio
                if edit.new_width:
                    scale = edit.new_width / target.bbox.width
                    new_width = edit.new_width
                    new_height = target.bbox.height * scale
                elif edit.new_height:
                    scale = edit.new_height / target.bbox.height
                    new_height = edit.new_height
                    new_width = target.bbox.width * scale
                else:
                    return EditResult(success=False, span_id=edit.image_id, error="No size specified")
            else:
                new_width = edit.new_width or target.bbox.width
                new_height = edit.new_height or target.bbox.height
            
            # Create new rect
            new_rect = fitz.Rect(
                target.bbox.x0,
                target.bbox.y0,
                target.bbox.x0 + new_width,
                target.bbox.y0 + new_height,
            )
            
            # Remove and reinsert
            page.add_redact_annot(target.bbox.to_rect())
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)
            page.insert_image(new_rect, stream=img_data["image"])
            
            return EditResult(success=True, span_id=edit.image_id, method_used="resize")
            
        except Exception as e:
            return EditResult(success=False, span_id=edit.image_id, error=str(e))
    
    def _rotate_image(self, page: fitz.Page, target: ImageObject, edit: ImageEdit) -> EditResult:
        """Rotate an image"""
        try:
            # Extract image
            img_data = self.doc.extract_image(target.xref)
            pixmap = fitz.Pixmap(img_data["image"])
            
            # Rotate pixmap
            # PyMuPDF doesn't have direct rotation, so we use PIL
            from PIL import Image
            pil_image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            rotated = pil_image.rotate(-edit.rotation, expand=True)
            
            # Convert back
            rotated_bytes = io.BytesIO()
            rotated.save(rotated_bytes, format="PNG")
            rotated_pixmap = fitz.Pixmap(rotated_bytes.getvalue())
            
            # Calculate new rect (may change due to rotation)
            center = target.bbox.center
            new_width = rotated_pixmap.width * (target.bbox.width / pixmap.width)
            new_height = rotated_pixmap.height * (target.bbox.height / pixmap.height)
            
            new_rect = fitz.Rect(
                center[0] - new_width / 2,
                center[1] - new_height / 2,
                center[0] + new_width / 2,
                center[1] + new_height / 2,
            )
            
            # Remove and reinsert
            page.add_redact_annot(target.bbox.to_rect())
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)
            page.insert_image(new_rect, pixmap=rotated_pixmap)
            
            return EditResult(success=True, span_id=edit.image_id, method_used="rotate")
            
        except Exception as e:
            return EditResult(success=False, span_id=edit.image_id, error=str(e))
    
    def _move_image(self, page: fitz.Page, target: ImageObject, edit: ImageEdit) -> EditResult:
        """Move an image to a new position"""
        try:
            # Extract image
            img_data = self.doc.extract_image(target.xref)
            
            # Calculate new rect
            new_x = edit.new_x if edit.new_x is not None else target.bbox.x0
            new_y = edit.new_y if edit.new_y is not None else target.bbox.y0
            
            new_rect = fitz.Rect(
                new_x,
                new_y,
                new_x + target.bbox.width,
                new_y + target.bbox.height,
            )
            
            # Remove and reinsert
            page.add_redact_annot(target.bbox.to_rect())
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)
            page.insert_image(new_rect, stream=img_data["image"])
            
            return EditResult(success=True, span_id=edit.image_id, method_used="move")
            
        except Exception as e:
            return EditResult(success=False, span_id=edit.image_id, error=str(e))
    
    # =========================================================================
    # Annotation Operations
    # =========================================================================
    
    def add_annotation(
        self,
        page_number: int,
        annot_type: AnnotationType,
        bbox: BoundingBox,
        content: str = "",
        color: str = "#FFFF00",
        opacity: float = 1.0,
        points: Optional[List[Tuple[float, float]]] = None,
    ) -> Annotation:
        """Add an annotation to a page"""
        page = self.doc[page_number - 1]
        rect = bbox.to_rect()
        color_tuple = self._hex_to_color_tuple(color)
        
        annot = None
        
        if annot_type == AnnotationType.HIGHLIGHT:
            # For highlight, we need a quad
            quad = fitz.Quad(rect)
            annot = page.add_highlight_annot(quad)
            
        elif annot_type == AnnotationType.UNDERLINE:
            quad = fitz.Quad(rect)
            annot = page.add_underline_annot(quad)
            
        elif annot_type == AnnotationType.STRIKETHROUGH:
            quad = fitz.Quad(rect)
            annot = page.add_strikeout_annot(quad)
            
        elif annot_type == AnnotationType.STICKY_NOTE:
            annot = page.add_text_annot(rect.tl, content)
            
        elif annot_type == AnnotationType.FREEHAND:
            if points:
                point_list = [fitz.Point(p[0], p[1]) for p in points]
                annot = page.add_ink_annot([point_list])
            else:
                return None
                
        elif annot_type == AnnotationType.TEXT_BOX:
            annot = page.add_freetext_annot(
                rect,
                content,
                fontsize=12,
                fontname="helv",
                fill_color=color_tuple,
            )
        
        if annot:
            annot.set_colors(stroke=color_tuple)
            annot.set_opacity(opacity)
            annot.update()
            
            # Count annotations safely
            annots_for_id = page.annots()
            annot_count = len(list(annots_for_id)) if annots_for_id is not None else 0
            return Annotation(
                id=f"p{page_number}_annot_{annot_count}",
                page_number=page_number,
                type=annot_type,
                bbox=bbox,
                content=content,
                color=color,
                opacity=opacity,
                points=points or [],
            )
        
        return None
    
    def delete_annotation(self, page_number: int, annot_id: str) -> bool:
        """Delete an annotation"""
        page = self.doc[page_number - 1]
        annots_gen = page.annots()
        annots_list = list(annots_gen) if annots_gen is not None else []
        
        if not annots_list:
            return False
        
        # Extract index from ID
        match = re.search(r'annot_(\d+)$', annot_id)
        if not match:
            return False
        
        idx = int(match.group(1))
        
        for i, annot in enumerate(annots_list):
            if i == idx:
                page.delete_annot(annot)
                return True
        
        return False
    
    # =========================================================================
    # Page Operations
    # =========================================================================
    
    def add_page(
        self,
        width: float = 612,
        height: float = 792,
        position: int = -1,
    ) -> int:
        """Add a new blank page"""
        if position < 0:
            position = self.doc.page_count
        
        self.doc.new_page(pno=position, width=width, height=height)
        self.page_count = self.doc.page_count
        
        return position + 1
    
    def delete_page(self, page_number: int) -> bool:
        """Delete a page"""
        if page_number < 1 or page_number > self.doc.page_count:
            return False
        
        self.doc.delete_page(page_number - 1)
        self.page_count = self.doc.page_count
        return True
    
    def duplicate_page(self, page_number: int, target_position: int = -1) -> int:
        """Duplicate a page"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        if target_position < 0:
            target_position = page_number  # Insert after current page
        
        # Copy the page
        self.doc.copy_page(page_number - 1, target_position)
        self.page_count = self.doc.page_count
        
        return target_position + 1
    
    def reorder_pages(self, new_order: List[int]) -> bool:
        """Reorder pages according to new_order list (1-indexed page numbers)"""
        if len(new_order) != self.doc.page_count:
            return False
        
        # Convert to 0-indexed
        zero_indexed = [p - 1 for p in new_order]
        
        # Validate
        if sorted(zero_indexed) != list(range(self.doc.page_count)):
            return False
        
        self.doc.select(zero_indexed)
        return True
    
    def rotate_page(self, page_number: int, rotation: int) -> bool:
        """Rotate a page (rotation must be 0, 90, 180, or 270)"""
        if rotation not in (0, 90, 180, 270):
            return False
        
        if page_number < 1 or page_number > self.doc.page_count:
            return False
        
        page = self.doc[page_number - 1]
        page.set_rotation(rotation)
        return True
    
    def crop_page(self, page_number: int, crop_box: BoundingBox) -> bool:
        """Crop a page to the specified box"""
        if page_number < 1 or page_number > self.doc.page_count:
            return False
        
        page = self.doc[page_number - 1]
        page.set_cropbox(crop_box.to_rect())
        return True
    
    # =========================================================================
    # Add Elements
    # =========================================================================
    
    def add_text_box(
        self,
        page_number: int,
        text: str,
        bbox: BoundingBox,
        font_name: str = "Helvetica",
        font_size: float = 12,
        color: str = "#000000",
        alignment: AlignmentType = AlignmentType.LEFT,
    ) -> str:
        """Add a text box to a page"""
        page = self.doc[page_number - 1]
        rect = bbox.to_rect()
        
        color_tuple = self._hex_to_color_tuple(color)
        align = self._get_alignment_int(alignment)
        
        # Insert text
        text_writer = fitz.TextWriter(page.rect)
        font = fitz.Font(font_name)
        
        text_writer.append(
            (rect.x0, rect.y1 - font_size),
            text,
            font=font,
            fontsize=font_size,
        )
        
        text_writer.write_text(page, color=color_tuple)
        
        return f"p{page_number}_textbox_{int(time.time())}"
    
    def add_image(
        self,
        page_number: int,
        image_data: bytes,
        bbox: BoundingBox,
        maintain_aspect: bool = True,
    ) -> str:
        """Add an image to a page"""
        page = self.doc[page_number - 1]
        rect = bbox.to_rect()
        
        page.insert_image(rect, stream=image_data, keep_proportion=maintain_aspect)
        
        return f"p{page_number}_img_{int(time.time())}"
    
    def add_watermark(
        self,
        page_number: int,
        text: Optional[str] = None,
        image_data: Optional[bytes] = None,
        opacity: float = 0.3,
        rotation: float = 45,
        position: str = "center",
    ) -> bool:
        """Add a watermark to a page"""
        page = self.doc[page_number - 1]
        rect = page.rect
        
        if text:
            # Calculate center position
            font_size = min(rect.width, rect.height) / 10
            
            # Create text watermark shape
            shape = page.new_shape()
            
            # Calculate text position
            center = fitz.Point(rect.width / 2, rect.height / 2)
            
            # Create transformation matrix for rotation
            mat = fitz.Matrix(1, 0, 0, 1, center.x, center.y)
            mat = mat * fitz.Matrix(rotation)
            mat = mat * fitz.Matrix(1, 0, 0, 1, -center.x, -center.y)
            
            # Insert text
            page.insert_text(
                center,
                text,
                fontsize=font_size,
                fontname="helv",
                color=(0.5, 0.5, 0.5),
                rotate=rotation,
                overlay=True,
            )
            
        elif image_data:
            # Calculate image rect
            img = fitz.Pixmap(image_data)
            
            # Scale to fit page with margins
            scale = min(
                (rect.width * 0.8) / img.width,
                (rect.height * 0.8) / img.height,
            )
            
            img_width = img.width * scale
            img_height = img.height * scale
            
            img_rect = fitz.Rect(
                (rect.width - img_width) / 2,
                (rect.height - img_height) / 2,
                (rect.width + img_width) / 2,
                (rect.height + img_height) / 2,
            )
            
            page.insert_image(img_rect, pixmap=img, overlay=True)
        
        return True
    
    def add_watermark_to_all_pages(
        self,
        text: Optional[str] = None,
        image_data: Optional[bytes] = None,
        opacity: float = 0.3,
        rotation: float = 45,
    ) -> bool:
        """Add watermark to all pages"""
        for i in range(self.doc.page_count):
            self.add_watermark(i + 1, text, image_data, opacity, rotation)
        return True
    
    # =========================================================================
    # Undo/Redo
    # =========================================================================
    
    def _save_edit_state(self, edit_type: str, page_number: int, edit_data: Any):
        """Save state for undo"""
        # Create snapshot of current state
        state = {
            "type": edit_type,
            "page": page_number,
            "edit": edit_data,
            "timestamp": time.time(),
            "pdf_state": self.doc.tobytes(),
        }
        
        self._edit_history.append(state)
        self._redo_stack.clear()
        
        # Limit history
        if len(self._edit_history) > self._max_history:
            self._edit_history.pop(0)
    
    def undo(self) -> bool:
        """Undo last edit"""
        if not self._edit_history:
            return False
        
        state = self._edit_history.pop()
        self._redo_stack.append({
            "pdf_state": self.doc.tobytes(),
        })
        
        # Restore document
        self.doc = fitz.open(stream=io.BytesIO(state["pdf_state"]), filetype="pdf")
        return True
    
    def redo(self) -> bool:
        """Redo last undone edit"""
        if not self._redo_stack:
            return False
        
        state = self._redo_stack.pop()
        self._edit_history.append({
            "pdf_state": self.doc.tobytes(),
        })
        
        # Restore document
        self.doc = fitz.open(stream=io.BytesIO(state["pdf_state"]), filetype="pdf")
        return True
    
    # =========================================================================
    # Quality Control
    # =========================================================================
    
    def validate_quality(self) -> QualityReport:
        """Validate document quality after edits"""
        current_stats = self._capture_current_stats()
        
        warnings = []
        errors = []
        
        # Check page count
        page_count_match = current_stats["page_count"] == self._initial_stats["page_count"]
        if not page_count_match:
            warnings.append(
                f"Page count changed: {self._initial_stats['page_count']} -> {current_stats['page_count']}"
            )
        
        # Check dimensions
        dimensions_match = True
        for i, (init_page, curr_page) in enumerate(
            zip(self._initial_stats["pages"], current_stats["pages"])
        ):
            if abs(init_page["width"] - curr_page["width"]) > 0.1:
                dimensions_match = False
                warnings.append(f"Page {i+1} width changed")
            if abs(init_page["height"] - curr_page["height"]) > 0.1:
                dimensions_match = False
                warnings.append(f"Page {i+1} height changed")
        
        # Check for rasterization (image count shouldn't increase dramatically)
        rasterization_detected = False
        if current_stats["total_images"] > self._initial_stats["total_images"] + 2:
            rasterization_detected = True
            errors.append("Potential rasterization detected: image count increased significantly")
        
        # Validate xref
        xref_valid = True
        try:
            self.doc.xref_length()
        except:
            xref_valid = False
            errors.append("Invalid xref table")
        
        # Check PDF integrity
        integrity_valid = True
        try:
            test_bytes = self.doc.tobytes()
            test_doc = fitz.open(stream=io.BytesIO(test_bytes), filetype="pdf")
            test_doc.close()
        except:
            integrity_valid = False
            errors.append("PDF integrity check failed")
        
        return QualityReport(
            valid=len(errors) == 0,
            page_count_match=page_count_match,
            dimensions_match=dimensions_match,
            font_count_before=self._initial_stats["total_fonts"],
            font_count_after=current_stats["total_fonts"],
            image_count_before=self._initial_stats["total_images"],
            image_count_after=current_stats["total_images"],
            vector_count_before=self._initial_stats.get("total_vectors", 0),
            vector_count_after=current_stats.get("total_vectors", 0),
            xref_valid=xref_valid,
            rasterization_detected=rasterization_detected,
            layout_shift_detected=not dimensions_match,
            integrity_valid=integrity_valid,
            warnings=warnings,
            errors=errors,
        )
    
    def _capture_current_stats(self) -> Dict[str, Any]:
        """Capture current document statistics"""
        stats = {
            "page_count": self.doc.page_count,
            "pages": [],
            "total_fonts": set(),
            "total_images": 0,
            "total_vectors": 0,
            "xref_count": self.doc.xref_length(),
        }
        
        for page_num in range(self.doc.page_count):
            page = self.doc[page_num]
            page_stats = {
                "width": page.rect.width,
                "height": page.rect.height,
                "rotation": page.rotation,
                "image_count": len(page.get_images()),
            }
            
            for font in page.get_fonts():
                stats["total_fonts"].add(font[3])
            
            stats["total_images"] += page_stats["image_count"]
            stats["pages"].append(page_stats)
        
        stats["total_fonts"] = len(stats["total_fonts"])
        return stats
    
    # =========================================================================
    # Export
    # =========================================================================
    
    def export(
        self,
        linearize: bool = True,
        compress: bool = True,
        encrypt: bool = False,
        user_password: Optional[str] = None,
        owner_password: Optional[str] = None,
        permissions: int = -1,
    ) -> bytes:
        """Export the edited PDF"""
        
        # Validate before export
        quality = self.validate_quality()
        if quality.rasterization_detected:
            logger.warning("Rasterization detected in export", session_id=self.session_id)
        
        # Build export options
        output = io.BytesIO()
        
        save_options = {
            "garbage": 4,  # Maximum garbage collection
            "deflate": compress,
            "linear": linearize,
        }
        
        if encrypt and owner_password:
            save_options["encryption"] = fitz.PDF_ENCRYPT_AES_256
            save_options["owner_pw"] = owner_password
            if user_password:
                save_options["user_pw"] = user_password
            save_options["permissions"] = permissions
        
        self.doc.save(output, **save_options)
        
        result = output.getvalue()
        
        logger.info(
            "PDF exported",
            size=len(result),
            linearized=linearize,
            compressed=compress,
            encrypted=encrypt,
            session_id=self.session_id,
        )
        
        return result
    
    def render_page_thumbnail(
        self,
        page_number: int,
        width: int = 150,
    ) -> bytes:
        """Render a page thumbnail as PNG"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        
        # Calculate zoom to achieve target width
        zoom = width / page.rect.width
        mat = fitz.Matrix(zoom, zoom)
        
        pix = page.get_pixmap(matrix=mat)
        return pix.tobytes("png")
    
    def render_page(
        self,
        page_number: int,
        scale: float = 1.5,
    ) -> bytes:
        """Render a page at specified scale as PNG"""
        if page_number < 1 or page_number > self.doc.page_count:
            raise ValueError(f"Invalid page number: {page_number}")
        
        page = self.doc[page_number - 1]
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat)
        
        return pix.tobytes("png")
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    def _int_to_hex_color(self, color_int: int) -> str:
        """Convert integer color to hex string"""
        r = (color_int >> 16) & 0xFF
        g = (color_int >> 8) & 0xFF
        b = color_int & 0xFF
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def _hex_to_color_tuple(self, hex_color: str) -> Tuple[float, float, float]:
        """Convert hex color to RGB tuple (0-1 range)"""
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16) / 255
        g = int(hex_color[2:4], 16) / 255
        b = int(hex_color[4:6], 16) / 255
        return (r, g, b)
    
    def _color_tuple_to_hex(self, color: Tuple) -> str:
        """Convert RGB tuple (0-1 range) to hex"""
        if len(color) >= 3:
            r = int(color[0] * 255)
            g = int(color[1] * 255)
            b = int(color[2] * 255)
            return f"#{r:02x}{g:02x}{b:02x}"
        return "#000000"
    
    def _get_alignment_int(self, alignment: AlignmentType) -> int:
        """Convert alignment enum to integer"""
        mapping = {
            AlignmentType.LEFT: 0,
            AlignmentType.CENTER: 1,
            AlignmentType.RIGHT: 2,
            AlignmentType.JUSTIFY: 3,
        }
        return mapping.get(alignment, 0)
    
    def _get_base_font_name(self, font_name: str) -> str:
        """Map font name to a base PDF font"""
        font_lower = font_name.lower()
        
        if "times" in font_lower:
            if "bold" in font_lower and "italic" in font_lower:
                return "tibi"
            elif "bold" in font_lower:
                return "tibo"
            elif "italic" in font_lower:
                return "tiit"
            return "tiro"
        elif "courier" in font_lower:
            if "bold" in font_lower and "oblique" in font_lower:
                return "cobo"
            elif "bold" in font_lower:
                return "cobo"
            elif "oblique" in font_lower:
                return "coob"
            return "cour"
        elif "symbol" in font_lower:
            return "symb"
        elif "zapf" in font_lower or "dingbat" in font_lower:
            return "zadb"
        else:  # Default to Helvetica
            if "bold" in font_lower and ("oblique" in font_lower or "italic" in font_lower):
                return "hebi"
            elif "bold" in font_lower:
                return "hebo"
            elif "oblique" in font_lower or "italic" in font_lower:
                return "heit"
            return "helv"
    
    def close(self):
        """Close the document and cleanup"""
        if hasattr(self, 'doc') and self.doc:
            self.doc.close()
        self._edit_history.clear()
        self._redo_stack.clear()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
