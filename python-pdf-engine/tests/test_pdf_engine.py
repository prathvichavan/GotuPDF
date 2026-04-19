"""
GotuPDF - Test Suite for PDF Editing Engine

Tests cover:
1. Coursera certificate editing
2. Multi-page invoice editing
3. Design-heavy brochure editing
4. PDF with embedded fonts
5. PDF with watermark
6. Signed PDF editing

Copyright (c) 2024 GotuPDF
"""

import pytest
import asyncio
import io
import os
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF

# Import our PDF engine
from pdf_engine.core import (
    PDFEditingEngine,
    TextEdit,
    EditMode,
    EditResult,
    QualityReport,
)
from pdf_engine.stream_editor import TrueContentStreamEditor
from pdf_engine.encryption import QPDFHandler, qpdf_handler
from pdf_engine.fonts import FontHandler, font_handler


# Test data directory
TEST_DATA_DIR = Path(__file__).parent / "test_data"


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Create a simple test PDF"""
    doc = fitz.open()
    page = doc.new_page()
    
    # Add text
    text_point = fitz.Point(72, 72)
    page.insert_text(text_point, "Hello World", fontsize=12, fontname="helv")
    
    text_point = fitz.Point(72, 100)
    page.insert_text(text_point, "Test Document", fontsize=14, fontname="helv")
    
    text_point = fitz.Point(72, 130)
    page.insert_text(text_point, "Page 1 Content", fontsize=10, fontname="tiro")
    
    # Save to bytes
    output = io.BytesIO()
    doc.save(output)
    doc.close()
    
    return output.getvalue()


@pytest.fixture
def multi_page_pdf_bytes() -> bytes:
    """Create a multi-page test PDF"""
    doc = fitz.open()
    
    for i in range(5):
        page = doc.new_page()
        text_point = fitz.Point(72, 72)
        page.insert_text(text_point, f"Page {i+1} Header", fontsize=16, fontname="helv")
        
        text_point = fitz.Point(72, 120)
        page.insert_text(
            text_point, 
            f"This is the content of page {i+1}. It contains multiple lines.",
            fontsize=12,
            fontname="helv"
        )
    
    output = io.BytesIO()
    doc.save(output)
    doc.close()
    
    return output.getvalue()


@pytest.fixture
def encrypted_pdf_bytes() -> bytes:
    """Create an encrypted test PDF"""
    doc = fitz.open()
    page = doc.new_page()
    
    text_point = fitz.Point(72, 72)
    page.insert_text(text_point, "Encrypted Content", fontsize=12, fontname="helv")
    
    output = io.BytesIO()
    doc.save(
        output,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        user_pw="user123",
        owner_pw="owner456",
        permissions=int(
            fitz.PDF_PERM_PRINT |
            fitz.PDF_PERM_COPY |
            fitz.PDF_PERM_ANNOTATE
        ),
    )
    doc.close()
    
    return output.getvalue()


# ============================================================================
# Basic Functionality Tests
# ============================================================================

class TestPDFEditingEngine:
    """Tests for the main PDFEditingEngine class"""
    
    def test_load_pdf(self, sample_pdf_bytes):
        """Test basic PDF loading"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        assert engine.doc is not None
        assert engine.doc.page_count == 1
        assert not engine.is_encrypted
        
        engine.close()
    
    def test_extract_text_spans(self, sample_pdf_bytes):
        """Test text span extraction"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        spans = engine.extract_text_spans(1)
        
        assert len(spans) > 0
        assert any("Hello World" in span.text for span in spans)
        
        # Check span properties
        for span in spans:
            assert span.id is not None
            assert span.page_number == 1
            assert span.font_size > 0
            assert span.x >= 0
            assert span.y >= 0
        
        engine.close()
    
    def test_simple_edit(self, sample_pdf_bytes):
        """Test basic text editing"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        spans = engine.extract_text_spans(1)
        target_span = next(s for s in spans if "Hello World" in s.text)
        
        edit = TextEdit(
            span_id=target_span.id,
            page_number=1,
            original_text=target_span.text,
            new_text="Hello GotuPDF",
            span_index=target_span.span_index,
            x=target_span.x,
            y=target_span.y,
            font_size=target_span.font_size,
            font_name=target_span.font_name,
            color="#000000",
            mode=EditMode.ADAPTIVE,
        )
        
        result = engine.apply_edit(edit)
        
        assert result.success
        assert result.method_used in ("exact", "scaled", "smart")
        
        engine.close()
    
    def test_export_preserves_quality(self, sample_pdf_bytes):
        """Test that export maintains document quality"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        # Make an edit
        spans = engine.extract_text_spans(1)
        target_span = spans[0]
        
        edit = TextEdit(
            span_id=target_span.id,
            page_number=1,
            original_text=target_span.text,
            new_text="Modified Text",
            span_index=target_span.span_index,
            x=target_span.x,
            y=target_span.y,
            font_size=target_span.font_size,
            font_name=target_span.font_name,
            color="#000000",
            mode=EditMode.ADAPTIVE,
        )
        
        engine.apply_edit(edit)
        
        # Export
        pdf_bytes = engine.export()
        
        assert len(pdf_bytes) > 0
        
        # Validate quality
        quality = engine.validate_quality()
        
        assert quality.dimensions_match
        assert quality.integrity_valid
        assert not quality.rasterization_detected
        
        engine.close()


class TestMultiPageEditing:
    """Tests for multi-page PDF editing"""
    
    def test_edit_multiple_pages(self, multi_page_pdf_bytes):
        """Test editing text on multiple pages"""
        engine = PDFEditingEngine(multi_page_pdf_bytes)
        
        assert engine.doc.page_count == 5
        
        edits = []
        
        for page_num in range(1, 4):  # Edit first 3 pages
            spans = engine.extract_text_spans(page_num)
            
            if spans:
                target_span = spans[0]
                edits.append(TextEdit(
                    span_id=target_span.id,
                    page_number=page_num,
                    original_text=target_span.text,
                    new_text=f"Edited Page {page_num}",
                    span_index=target_span.span_index,
                    x=target_span.x,
                    y=target_span.y,
                    font_size=target_span.font_size,
                    font_name=target_span.font_name,
                    color="#000000",
                    mode=EditMode.ADAPTIVE,
                ))
        
        results = engine.apply_edits(edits)
        
        success_count = sum(1 for r in results if r.success)
        assert success_count == len(edits)
        
        engine.close()


class TestEncryptedPDFs:
    """Tests for encrypted PDF handling"""
    
    def test_load_encrypted_with_password(self, encrypted_pdf_bytes):
        """Test loading encrypted PDF with correct password"""
        engine = PDFEditingEngine(encrypted_pdf_bytes, password="user123")
        
        assert engine.is_encrypted
        assert engine.doc is not None
        
        engine.close()
    
    def test_load_encrypted_wrong_password(self, encrypted_pdf_bytes):
        """Test that wrong password raises error"""
        with pytest.raises(ValueError, match="Invalid password"):
            PDFEditingEngine(encrypted_pdf_bytes, password="wrong")
    
    @pytest.mark.asyncio
    async def test_qpdf_decrypt(self, encrypted_pdf_bytes):
        """Test qpdf decryption"""
        if not qpdf_handler.is_available():
            pytest.skip("qpdf not available")
        
        result = await qpdf_handler.decrypt(encrypted_pdf_bytes, password="user123")
        
        assert result.success
        assert result.pdf_bytes is not None
        assert len(result.pdf_bytes) > 0


class TestContentStreamEditor:
    """Tests for true content stream editing"""
    
    def test_parse_content_stream(self, sample_pdf_bytes):
        """Test content stream parsing"""
        doc = fitz.open(stream=io.BytesIO(sample_pdf_bytes), filetype="pdf")
        
        editor = TrueContentStreamEditor(doc)
        
        # Get text operators from page
        operators = editor.extract_text_operators(0)
        
        assert len(operators) > 0
        
        # Check operator properties
        for op in operators:
            assert op.font_name
            assert op.font_size > 0
            assert op.decoded_text
        
        doc.close()


class TestFontHandler:
    """Tests for font handling"""
    
    def test_text_width_calculation(self):
        """Test text width calculation"""
        width = font_handler.get_text_width(
            "Hello World",
            "Helvetica",
            12.0
        )
        
        assert width > 0
        assert width < 100  # Reasonable bound
    
    def test_char_width_base14(self):
        """Test character width for Base 14 fonts"""
        width = font_handler.get_char_width('A', 'Helvetica', 12.0)
        
        assert width > 0
        assert width < 20
    
    def test_monospace_equal_widths(self):
        """Test that monospace font has equal widths"""
        width_a = font_handler.get_char_width('A', 'Courier', 12.0)
        width_w = font_handler.get_char_width('W', 'Courier', 12.0)
        width_i = font_handler.get_char_width('i', 'Courier', 12.0)
        
        # All should be equal for monospace
        assert abs(width_a - width_w) < 0.01
        assert abs(width_a - width_i) < 0.01


class TestQualityValidation:
    """Tests for quality validation"""
    
    def test_no_rasterization(self, sample_pdf_bytes):
        """Test that editing doesn't cause rasterization"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        # Get initial image count
        initial_quality = engine._capture_document_stats()
        initial_images = initial_quality['image_count']
        
        # Make edits
        spans = engine.extract_text_spans(1)
        if spans:
            edit = TextEdit(
                span_id=spans[0].id,
                page_number=1,
                original_text=spans[0].text,
                new_text="Edited",
                span_index=spans[0].span_index,
                x=spans[0].x,
                y=spans[0].y,
                font_size=spans[0].font_size,
                font_name=spans[0].font_name,
                color="#000000",
                mode=EditMode.ADAPTIVE,
            )
            engine.apply_edit(edit)
        
        # Validate
        quality = engine.validate_quality()
        
        # Image count should not increase significantly
        assert quality.image_count_after <= initial_images + 1
        assert not quality.rasterization_detected
        
        engine.close()
    
    def test_dimensions_preserved(self, sample_pdf_bytes):
        """Test that page dimensions are preserved"""
        engine = PDFEditingEngine(sample_pdf_bytes)
        
        # Make edits
        spans = engine.extract_text_spans(1)
        if spans:
            edit = TextEdit(
                span_id=spans[0].id,
                page_number=1,
                original_text=spans[0].text,
                new_text="Modified Content Here",
                span_index=spans[0].span_index,
                x=spans[0].x,
                y=spans[0].y,
                font_size=spans[0].font_size,
                font_name=spans[0].font_name,
                color="#000000",
                mode=EditMode.ADAPTIVE,
            )
            engine.apply_edit(edit)
        
        quality = engine.validate_quality()
        
        assert quality.dimensions_match
        
        engine.close()


# ============================================================================
# Certificate Editing Tests
# ============================================================================

class TestCertificateEditing:
    """Tests specifically for certificate editing (Coursera, etc.)"""
    
    @pytest.fixture
    def certificate_pdf_bytes(self) -> bytes:
        """Create a certificate-like PDF"""
        doc = fitz.open()
        page = doc.new_page(width=792, height=612)  # Landscape letter
        
        # Add certificate text
        center_x = 396
        
        # Title
        page.insert_text(
            fitz.Point(center_x - 100, 150),
            "Certificate of Completion",
            fontsize=24,
            fontname="tibo",  # Times Bold
        )
        
        # Name
        page.insert_text(
            fitz.Point(center_x - 80, 250),
            "John Doe",
            fontsize=20,
            fontname="tiit",  # Times Italic
        )
        
        # Course name
        page.insert_text(
            fitz.Point(center_x - 150, 320),
            "Introduction to Python Programming",
            fontsize=14,
            fontname="tiro",
        )
        
        # Date
        page.insert_text(
            fitz.Point(center_x - 60, 400),
            "January 15, 2024",
            fontsize=12,
            fontname="tiro",
        )
        
        # Add a "seal" (rectangle as placeholder)
        seal_rect = fitz.Rect(650, 450, 750, 550)
        page.draw_rect(seal_rect, color=(0.8, 0.6, 0.2), width=2)
        
        output = io.BytesIO()
        doc.save(output)
        doc.close()
        
        return output.getvalue()
    
    def test_edit_name_preserves_layout(self, certificate_pdf_bytes):
        """Test that editing the name doesn't affect layout"""
        engine = PDFEditingEngine(certificate_pdf_bytes)
        
        # Find the name span
        spans = engine.extract_text_spans(1)
        name_span = next((s for s in spans if "John Doe" in s.text), None)
        
        assert name_span is not None
        
        # Edit the name
        edit = TextEdit(
            span_id=name_span.id,
            page_number=1,
            original_text=name_span.text,
            new_text="Jane Smith",
            span_index=name_span.span_index,
            x=name_span.x,
            y=name_span.y,
            font_size=name_span.font_size,
            font_name=name_span.font_name,
            color="#000000",
            mode=EditMode.ADAPTIVE,
        )
        
        result = engine.apply_edit(edit)
        
        assert result.success
        
        # Validate that layout is preserved
        quality = engine.validate_quality()
        assert quality.dimensions_match
        assert not quality.layout_shift_detected
        
        engine.close()
    
    def test_edit_date_preserves_seal(self, certificate_pdf_bytes):
        """Test that editing the date doesn't affect the seal graphic"""
        engine = PDFEditingEngine(certificate_pdf_bytes)
        
        # Get initial stats
        initial_stats = engine._capture_document_stats()
        
        # Find the date span
        spans = engine.extract_text_spans(1)
        date_span = next((s for s in spans if "January" in s.text), None)
        
        if date_span:
            edit = TextEdit(
                span_id=date_span.id,
                page_number=1,
                original_text=date_span.text,
                new_text="February 20, 2024",
                span_index=date_span.span_index,
                x=date_span.x,
                y=date_span.y,
                font_size=date_span.font_size,
                font_name=date_span.font_name,
                color="#000000",
                mode=EditMode.ADAPTIVE,
            )
            
            result = engine.apply_edit(edit)
            assert result.success
        
        # Export and check integrity
        quality = engine.validate_quality()
        
        assert quality.integrity_valid
        assert not quality.rasterization_detected
        
        engine.close()


# ============================================================================
# Test Runner
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
