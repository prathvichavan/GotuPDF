"""
GotuPDF - Font Handler

Advanced font handling using fontTools for:
- Font extraction from PDFs
- Font subsetting
- Font encoding analysis
- Glyph width calculations
- Unicode mapping

Copyright (c) 2024 GotuPDF
"""

import io
import re
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from pathlib import Path
import structlog

try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.statisticsPen import StatisticsPen
    from fontTools.subset import Subsetter, Options as SubsetOptions
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False

logger = structlog.get_logger(__name__)


@dataclass
class GlyphMetrics:
    """Metrics for a single glyph"""
    glyph_name: str
    unicode: Optional[int]
    width: float  # In font units
    lsb: float  # Left side bearing
    xMin: float
    yMin: float
    xMax: float
    yMax: float


@dataclass
class FontMetrics:
    """Complete font metrics"""
    family_name: str
    full_name: str
    postscript_name: str
    units_per_em: int
    ascender: float
    descender: float
    cap_height: float
    x_height: float
    line_gap: float
    is_fixed_pitch: bool
    italic_angle: float
    weight: int  # 100-900
    glyph_count: int
    
    # Character-to-width mapping
    char_widths: Dict[str, float] = field(default_factory=dict)


@dataclass
class FontEncoding:
    """Font encoding information"""
    encoding_name: str
    platform_id: int
    platform_specific_id: int
    cmap_format: int
    
    # Unicode to glyph ID mapping
    codepoint_to_gid: Dict[int, int] = field(default_factory=dict)
    
    # Reverse mapping
    gid_to_codepoints: Dict[int, List[int]] = field(default_factory=dict)


@dataclass
class EmbeddedFont:
    """Embedded font extracted from PDF"""
    name: str
    base_font: str
    font_type: str  # Type1, TrueType, CIDFontType0, etc.
    is_subset: bool
    encoding: Optional[FontEncoding]
    to_unicode: Optional[Dict[int, str]]
    metrics: Optional[FontMetrics]
    font_bytes: Optional[bytes]
    xref: int


class FontHandler:
    """
    Advanced font handler for PDF text editing.
    
    Provides:
    - Font extraction from PDFs
    - Font metrics calculation
    - Text width measurement
    - Subsetting for edited text
    - Encoding conversion
    """
    
    # Standard PDF Base 14 fonts
    BASE_14_FONTS = {
        'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
        'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
        'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
        'Symbol', 'ZapfDingbats',
    }
    
    # Approximate character widths for Base 14 fonts (in 1/1000 em units)
    BASE_14_WIDTHS = {
        'Helvetica': {
            'default': 556,
            ' ': 278, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556,
            'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500,
            'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556,
            'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722,
            'x': 500, 'y': 500, 'z': 500,
            'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611,
            'G': 778, 'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556,
            'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722,
            'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
            'Y': 667, 'Z': 611,
            '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556,
            '6': 556, '7': 556, '8': 556, '9': 556,
            '.': 278, ',': 278, ':': 278, ';': 278, '!': 278, '?': 556,
        },
        'Times-Roman': {
            'default': 500,
            ' ': 250, 'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444,
            'f': 333, 'g': 500, 'h': 500, 'i': 278, 'j': 278, 'k': 500,
            'l': 278, 'm': 778, 'n': 500, 'o': 500, 'p': 500, 'q': 500,
            'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722,
            'x': 500, 'y': 500, 'z': 444,
            'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556,
            'G': 722, 'H': 722, 'I': 333, 'J': 389, 'K': 722, 'L': 611,
            'M': 889, 'N': 722, 'O': 722, 'P': 556, 'Q': 722, 'R': 667,
            'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944, 'X': 722,
            'Y': 722, 'Z': 611,
        },
        'Courier': {
            'default': 600,  # Monospace - all characters are 600 units
        },
    }
    
    def __init__(self):
        self._font_cache: Dict[str, TTFont] = {}
        self._metrics_cache: Dict[str, FontMetrics] = {}
    
    def is_base14_font(self, font_name: str) -> bool:
        """Check if font is one of the PDF Base 14 fonts"""
        # Clean font name
        clean_name = font_name.replace('+', '').split(',')[0].strip()
        
        for base_name in self.BASE_14_FONTS:
            if clean_name.startswith(base_name) or base_name in clean_name:
                return True
        
        return False
    
    def get_char_width(
        self,
        char: str,
        font_name: str,
        font_size: float,
        font_bytes: Optional[bytes] = None,
    ) -> float:
        """
        Get character width in points.
        
        Args:
            char: Character to measure
            font_name: PDF font name
            font_size: Font size in points
            font_bytes: Embedded font data (optional)
            
        Returns:
            Width in points
        """
        # Try embedded font first
        if font_bytes and FONTTOOLS_AVAILABLE:
            try:
                width_units = self._get_embedded_font_width(char, font_bytes)
                if width_units is not None:
                    return width_units / 1000 * font_size
            except Exception as e:
                logger.debug("Embedded font width lookup failed", error=str(e))
        
        # Fall back to Base 14 approximations
        base_font = self._get_base14_name(font_name)
        
        if base_font in self.BASE_14_WIDTHS:
            widths = self.BASE_14_WIDTHS[base_font]
            width_units = widths.get(char, widths.get('default', 500))
            return width_units / 1000 * font_size
        
        # Default width estimate
        return font_size * 0.5
    
    def get_text_width(
        self,
        text: str,
        font_name: str,
        font_size: float,
        font_bytes: Optional[bytes] = None,
        kerning: bool = True,
    ) -> float:
        """
        Calculate total text width in points.
        
        Args:
            text: Text to measure
            font_name: PDF font name
            font_size: Font size in points
            font_bytes: Embedded font data (optional)
            kerning: Whether to apply kerning adjustments
            
        Returns:
            Total width in points
        """
        total_width = 0.0
        
        for i, char in enumerate(text):
            char_width = self.get_char_width(char, font_name, font_size, font_bytes)
            total_width += char_width
            
            # Apply kerning (simplified)
            if kerning and i > 0:
                total_width += self._get_kerning(text[i-1], char, font_name, font_size)
        
        return total_width
    
    def _get_kerning(
        self,
        left_char: str,
        right_char: str,
        font_name: str,
        font_size: float,
    ) -> float:
        """Get kerning adjustment between two characters"""
        # Common kerning pairs (simplified)
        kerning_pairs = {
            ('A', 'V'): -80, ('A', 'W'): -60, ('A', 'Y'): -100,
            ('A', 'v'): -40, ('A', 'w'): -30, ('A', 'y'): -50,
            ('F', 'a'): -30, ('F', 'o'): -30, ('F', '.'):- 100,
            ('L', 'T'): -120, ('L', 'V'): -120, ('L', 'W'): -80,
            ('L', 'Y'): -140, ('L', 'y'): -70,
            ('P', 'a'): -50, ('P', 'e'): -50, ('P', 'o'): -55,
            ('P', '.'):- 130, ('P', ','):- 130,
            ('T', 'a'): -90, ('T', 'e'): -90, ('T', 'o'): -90,
            ('T', 'r'): -50, ('T', '.'):- 80, ('T', ','):- 80,
            ('V', 'a'): -60, ('V', 'e'): -50, ('V', 'o'): -65,
            ('V', '.'):- 130, ('V', ','):- 130,
            ('W', 'a'): -50, ('W', 'e'): -40, ('W', 'o'): -45,
            ('Y', 'a'): -90, ('Y', 'e'): -85, ('Y', 'o'): -100,
            ('Y', '.'):- 100, ('Y', ','):- 100,
            ('f', 'f'): 20, ('f', 'i'): 20, ('f', 'l'): 20,
        }
        
        kern_units = kerning_pairs.get((left_char, right_char), 0)
        return kern_units / 1000 * font_size
    
    def _get_base14_name(self, font_name: str) -> str:
        """Map PDF font name to Base 14 name"""
        clean = font_name.replace('+', '').split(',')[0].split('-')[0].strip()
        
        if 'Helvetica' in font_name or 'Arial' in font_name or 'Sans' in font_name:
            return 'Helvetica'
        elif 'Times' in font_name or 'Serif' in font_name:
            return 'Times-Roman'
        elif 'Courier' in font_name or 'Mono' in font_name:
            return 'Courier'
        
        return 'Helvetica'  # Default
    
    def _get_embedded_font_width(self, char: str, font_bytes: bytes) -> Optional[float]:
        """Get character width from embedded font"""
        if not FONTTOOLS_AVAILABLE:
            return None
        
        # Create cache key from font bytes hash
        import hashlib
        cache_key = hashlib.md5(font_bytes[:1024]).hexdigest()
        
        if cache_key not in self._font_cache:
            try:
                font = TTFont(io.BytesIO(font_bytes))
                self._font_cache[cache_key] = font
            except Exception as e:
                logger.debug("Failed to load font", error=str(e))
                return None
        
        font = self._font_cache[cache_key]
        
        # Get glyph ID for character
        cmap = font.getBestCmap()
        if not cmap:
            return None
        
        code_point = ord(char)
        glyph_id = cmap.get(code_point)
        
        if glyph_id is None:
            return None
        
        # Get glyph width
        try:
            glyph_set = font.getGlyphSet()
            glyph = glyph_set[glyph_id]
            return glyph.width
        except:
            return None
    
    def extract_fonts_from_pdf(
        self,
        doc,  # fitz.Document
    ) -> Dict[str, EmbeddedFont]:
        """
        Extract all embedded fonts from a PDF.
        
        Returns dict mapping font name to EmbeddedFont.
        """
        fonts = {}
        
        for page_num in range(doc.page_count):
            page = doc[page_num]
            page_fonts = page.get_fonts()
            
            for font_entry in page_fonts:
                xref, ext, font_type, base_font, name, encoding = font_entry[:6]
                
                if name in fonts:
                    continue  # Already extracted
                
                # Determine if subset
                is_subset = '+' in (base_font or '')
                
                # Try to extract font bytes
                font_bytes = None
                try:
                    font_bytes = doc.xref_stream(xref)
                except:
                    pass
                
                # Parse encoding
                encoding_info = self._parse_font_encoding(doc, xref)
                
                # Parse ToUnicode if available
                to_unicode = self._parse_to_unicode(doc, xref)
                
                # Get metrics if font bytes available
                metrics = None
                if font_bytes and FONTTOOLS_AVAILABLE:
                    metrics = self._parse_font_metrics(font_bytes)
                
                fonts[name] = EmbeddedFont(
                    name=name,
                    base_font=base_font or name,
                    font_type=font_type or "Unknown",
                    is_subset=is_subset,
                    encoding=encoding_info,
                    to_unicode=to_unicode,
                    metrics=metrics,
                    font_bytes=font_bytes,
                    xref=xref,
                )
        
        return fonts
    
    def _parse_font_encoding(self, doc, xref: int) -> Optional[FontEncoding]:
        """Parse font encoding from PDF font object"""
        try:
            font_obj = doc.xref_object(xref)
            
            # Extract encoding name
            encoding_match = re.search(r'/Encoding\s*/(\w+)', font_obj)
            encoding_name = encoding_match.group(1) if encoding_match else "WinAnsiEncoding"
            
            return FontEncoding(
                encoding_name=encoding_name,
                platform_id=3,  # Windows
                platform_specific_id=1,  # Unicode BMP
                cmap_format=4,
            )
        except:
            return None
    
    def _parse_to_unicode(self, doc, xref: int) -> Optional[Dict[int, str]]:
        """Parse ToUnicode CMap from font"""
        try:
            font_obj = doc.xref_object(xref)
            
            # Find ToUnicode reference
            match = re.search(r'/ToUnicode\s+(\d+)\s+\d+\s+R', font_obj)
            if not match:
                return None
            
            tounicode_xref = int(match.group(1))
            cmap_stream = doc.xref_stream(tounicode_xref)
            cmap_text = cmap_stream.decode('latin-1', errors='replace')
            
            unicode_map = {}
            
            # Parse bfchar entries
            for m in re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', cmap_text):
                code = int(m.group(1), 16)
                unicode_hex = m.group(2)
                
                if len(unicode_hex) >= 4:
                    # UTF-16BE
                    unicode_bytes = bytes.fromhex(unicode_hex)
                    unicode_str = unicode_bytes.decode('utf-16-be', errors='replace')
                else:
                    unicode_str = chr(int(unicode_hex, 16))
                
                unicode_map[code] = unicode_str
            
            return unicode_map if unicode_map else None
            
        except Exception as e:
            logger.debug("Failed to parse ToUnicode", error=str(e))
            return None
    
    def _parse_font_metrics(self, font_bytes: bytes) -> Optional[FontMetrics]:
        """Parse font metrics using fontTools"""
        if not FONTTOOLS_AVAILABLE:
            return None
        
        try:
            font = TTFont(io.BytesIO(font_bytes))
            
            # Get name table entries
            name_table = font.get('name')
            family_name = self._get_name_entry(name_table, 1) or "Unknown"
            full_name = self._get_name_entry(name_table, 4) or family_name
            ps_name = self._get_name_entry(name_table, 6) or family_name
            
            # Get metrics from various tables
            head = font.get('head')
            os2 = font.get('OS/2')
            hhea = font.get('hhea')
            post = font.get('post')
            
            units_per_em = head.unitsPerEm if head else 1000
            
            ascender = os2.sTypoAscender if os2 else (hhea.ascent if hhea else 800)
            descender = os2.sTypoDescender if os2 else (hhea.descent if hhea else -200)
            
            cap_height = os2.sCapHeight if os2 and hasattr(os2, 'sCapHeight') else ascender * 0.7
            x_height = os2.sxHeight if os2 and hasattr(os2, 'sxHeight') else ascender * 0.5
            
            line_gap = os2.sTypoLineGap if os2 else (hhea.lineGap if hhea else 0)
            
            is_fixed = post.isFixedPitch if post else False
            italic_angle = post.italicAngle if post else 0
            weight = os2.usWeightClass if os2 else 400
            
            # Build character widths
            char_widths = {}
            cmap = font.getBestCmap()
            glyph_set = font.getGlyphSet()
            
            if cmap and glyph_set:
                for code_point, glyph_name in cmap.items():
                    if code_point < 128:  # ASCII range
                        try:
                            glyph = glyph_set[glyph_name]
                            char_widths[chr(code_point)] = glyph.width
                        except:
                            pass
            
            return FontMetrics(
                family_name=family_name,
                full_name=full_name,
                postscript_name=ps_name,
                units_per_em=units_per_em,
                ascender=ascender,
                descender=descender,
                cap_height=cap_height,
                x_height=x_height,
                line_gap=line_gap,
                is_fixed_pitch=is_fixed,
                italic_angle=italic_angle,
                weight=weight,
                glyph_count=len(font.getGlyphOrder()),
                char_widths=char_widths,
            )
            
        except Exception as e:
            logger.debug("Failed to parse font metrics", error=str(e))
            return None
    
    def _get_name_entry(self, name_table, name_id: int) -> Optional[str]:
        """Get name table entry"""
        if not name_table:
            return None
        
        for record in name_table.names:
            if record.nameID == name_id:
                try:
                    return record.toUnicode()
                except:
                    try:
                        return record.string.decode('latin-1')
                    except:
                        pass
        
        return None
    
    def subset_font(
        self,
        font_bytes: bytes,
        characters: Set[str],
    ) -> Optional[bytes]:
        """
        Create a font subset containing only the specified characters.
        
        This is useful when adding new text that uses characters
        not in the original subset.
        """
        if not FONTTOOLS_AVAILABLE:
            return None
        
        try:
            font = TTFont(io.BytesIO(font_bytes))
            
            # Create subsetter
            options = SubsetOptions()
            options.layout_features = ['*']  # Keep all OpenType features
            options.name_IDs = ['*']  # Keep all name table entries
            options.notdef_outline = True
            
            subsetter = Subsetter(options=options)
            
            # Add characters to subset
            codepoints = set(ord(c) for c in characters)
            subsetter.populate(unicodes=codepoints)
            
            # Subset the font
            subsetter.subset(font)
            
            # Export
            output = io.BytesIO()
            font.save(output)
            return output.getvalue()
            
        except Exception as e:
            logger.error("Font subsetting failed", error=str(e))
            return None


# Singleton instance
font_handler = FontHandler()


__all__ = [
    "FontHandler",
    "font_handler",
    "GlyphMetrics",
    "FontMetrics",
    "FontEncoding",
    "EmbeddedFont",
    "FONTTOOLS_AVAILABLE",
]
