"""
GotuPDF - Industry-Grade PDF Editing Engine

True in-place content stream editing without overlays,
rasterization, or page regeneration.

Copyright (c) 2024 GotuPDF
"""

from pdf_engine.core import (
    PDFEditingEngine,
    AdvancedPDFEditor,
    TextSpan,
    TextEdit,
    EditResult,
    EditMode,
    QualityReport,
)

from pdf_engine.stream_editor import (
    ContentStreamParser,
    TrueContentStreamEditor,
    TextShowOperator,
    FontInfo,
)

__version__ = "1.0.0"
__author__ = "GotuPDF"

__all__ = [
    # Core
    "PDFEditingEngine",
    "AdvancedPDFEditor",
    "TextSpan",
    "TextEdit",
    "EditResult",
    "EditMode",
    "QualityReport",
    # Stream Editor
    "ContentStreamParser",
    "TrueContentStreamEditor",
    "TextShowOperator",
    "FontInfo",
]
