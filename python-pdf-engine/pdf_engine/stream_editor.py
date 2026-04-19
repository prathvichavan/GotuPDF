"""
GotuPDF - True Content Stream Editor

This module provides byte-level PDF content stream manipulation
for exact in-place text editing.

Key Features:
- Direct content stream parsing
- Exact text operator location (Tj, TJ, ', ")
- Byte-level text replacement
- Font encoding handling
- Kerning preservation
- Object reference preservation

This is NOT an overlay system. This modifies actual PDF content streams.

Copyright (c) 2024 GotuPDF
"""

import fitz  # PyMuPDF
import re
import zlib
import struct
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from io import BytesIO
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ContentStreamOperator:
    """Represents a PDF content stream operator with operands"""
    operator: str
    operands: List[Any]
    start_offset: int  # Byte offset in decompressed stream
    end_offset: int
    raw_bytes: bytes  # Original bytes


@dataclass
class TextShowOperator:
    """Represents a text showing operator (Tj, TJ, ', ")"""
    operator_type: str  # "Tj", "TJ", "'", '"'
    text_bytes: bytes  # Raw text bytes
    decoded_text: str  # Decoded Unicode text
    font_name: str
    font_size: float
    position: Tuple[float, float]  # X, Y in PDF coordinates
    color: Tuple[float, float, float]  # RGB
    text_matrix: List[float]  # 6-element transformation matrix
    
    # For TJ operator: list of (text_bytes, adjustment) tuples
    tj_array: Optional[List[Tuple[bytes, float]]] = None
    
    # Stream locations for exact replacement
    stream_index: int = 0
    start_offset: int = 0
    end_offset: int = 0
    
    # Encoding info
    encoding_name: str = "WinAnsiEncoding"
    to_unicode_map: Optional[Dict[int, str]] = None
    reverse_map: Optional[Dict[str, bytes]] = None


@dataclass
class FontInfo:
    """Complete font information for encoding/decoding"""
    name: str
    base_font: str
    encoding: str
    to_unicode: Optional[Dict[int, str]] = None
    reverse_unicode: Optional[Dict[str, bytes]] = None
    widths: Optional[Dict[int, float]] = None
    is_cid_font: bool = False
    cid_to_gid: Optional[Dict[int, int]] = None
    default_width: float = 1000
    byte_length: int = 1  # Bytes per character code


class ContentStreamParser:
    """
    Low-level PDF content stream parser.
    
    Parses content stream operators and operands for exact editing.
    """
    
    # PDF operators that affect text
    TEXT_OPERATORS = {'Tj', 'TJ', "'", '"', 'BT', 'ET', 'Tf', 'Tm', 'Td', 'TD', 'T*'}
    
    # Whitespace characters in PDF
    WHITESPACE = b' \t\n\r\x00\x0c'
    
    # Delimiter characters
    DELIMITERS = b'()<>[]{}/%'
    
    def __init__(self, content_stream: bytes):
        self.stream = content_stream
        self.pos = 0
        self.length = len(content_stream)
    
    def parse(self) -> List[ContentStreamOperator]:
        """Parse entire content stream into operators"""
        operators = []
        operand_stack = []
        
        while self.pos < self.length:
            self._skip_whitespace()
            if self.pos >= self.length:
                break
            
            start_pos = self.pos
            token = self._read_token()
            
            if token is None:
                break
            
            # Check if token is an operator
            if isinstance(token, str) and self._is_operator(token):
                operators.append(ContentStreamOperator(
                    operator=token,
                    operands=operand_stack.copy(),
                    start_offset=start_pos,
                    end_offset=self.pos,
                    raw_bytes=self.stream[start_pos:self.pos]
                ))
                operand_stack.clear()
            else:
                operand_stack.append(token)
        
        return operators
    
    def _skip_whitespace(self):
        """Skip whitespace and comments"""
        while self.pos < self.length:
            ch = self.stream[self.pos:self.pos+1]
            if ch in self.WHITESPACE:
                self.pos += 1
            elif ch == b'%':
                # Skip comment until end of line
                while self.pos < self.length and self.stream[self.pos:self.pos+1] not in b'\r\n':
                    self.pos += 1
            else:
                break
    
    def _read_token(self) -> Optional[Any]:
        """Read next token from stream"""
        if self.pos >= self.length:
            return None
        
        ch = self.stream[self.pos:self.pos+1]
        
        # String literal
        if ch == b'(':
            return self._read_literal_string()
        
        # Hex string
        if ch == b'<':
            if self.pos + 1 < self.length and self.stream[self.pos+1:self.pos+2] == b'<':
                return self._read_dict()
            return self._read_hex_string()
        
        # Array
        if ch == b'[':
            return self._read_array()
        
        # Name
        if ch == b'/':
            return self._read_name()
        
        # Number or operator
        return self._read_number_or_operator()
    
    def _read_literal_string(self) -> bytes:
        """Read parenthesis-delimited string"""
        start = self.pos
        self.pos += 1  # Skip opening (
        depth = 1
        
        while self.pos < self.length and depth > 0:
            ch = self.stream[self.pos:self.pos+1]
            if ch == b'\\':
                self.pos += 2  # Skip escape sequence
            elif ch == b'(':
                depth += 1
                self.pos += 1
            elif ch == b')':
                depth -= 1
                self.pos += 1
            else:
                self.pos += 1
        
        return self.stream[start:self.pos]
    
    def _read_hex_string(self) -> bytes:
        """Read hex string <...>"""
        start = self.pos
        self.pos += 1  # Skip <
        
        while self.pos < self.length:
            if self.stream[self.pos:self.pos+1] == b'>':
                self.pos += 1
                break
            self.pos += 1
        
        return self.stream[start:self.pos]
    
    def _read_array(self) -> List[Any]:
        """Read array [...]"""
        self.pos += 1  # Skip [
        items = []
        
        while self.pos < self.length:
            self._skip_whitespace()
            if self.stream[self.pos:self.pos+1] == b']':
                self.pos += 1
                break
            
            token = self._read_token()
            if token is not None:
                items.append(token)
        
        return items
    
    def _read_dict(self) -> Dict[str, Any]:
        """Read dictionary <<...>>"""
        self.pos += 2  # Skip <<
        result = {}
        
        while self.pos < self.length:
            self._skip_whitespace()
            if self.stream[self.pos:self.pos+2] == b'>>':
                self.pos += 2
                break
            
            # Read key (should be name)
            key = self._read_token()
            if isinstance(key, str) and key.startswith('/'):
                self._skip_whitespace()
                value = self._read_token()
                result[key[1:]] = value
        
        return result
    
    def _read_name(self) -> str:
        """Read name object /..."""
        start = self.pos
        self.pos += 1  # Skip /
        
        while self.pos < self.length:
            ch = self.stream[self.pos:self.pos+1]
            if ch in self.WHITESPACE or ch in self.DELIMITERS:
                break
            self.pos += 1
        
        return self.stream[start:self.pos].decode('latin-1')
    
    def _read_number_or_operator(self) -> Union[float, int, str]:
        """Read number or operator name"""
        start = self.pos
        is_number = True
        has_dot = False
        
        while self.pos < self.length:
            ch = self.stream[self.pos:self.pos+1]
            if ch in self.WHITESPACE or ch in self.DELIMITERS:
                break
            
            if ch == b'.':
                if has_dot:
                    is_number = False
                has_dot = True
            elif ch not in b'0123456789+-':
                is_number = False
            
            self.pos += 1
        
        token_bytes = self.stream[start:self.pos]
        token_str = token_bytes.decode('latin-1')
        
        if is_number and token_str:
            try:
                if '.' in token_str:
                    return float(token_str)
                return int(token_str)
            except ValueError:
                pass
        
        return token_str
    
    def _is_operator(self, token: str) -> bool:
        """Check if token is a PDF operator"""
        # PDF operators are typically 1-3 letters
        if not token or not token[0].isalpha():
            return False
        if len(token) > 4:
            return False
        return True


class TrueContentStreamEditor:
    """
    True content stream editor for exact PDF text modification.
    
    This class provides:
    - Byte-level content stream parsing
    - Exact text operator location
    - In-place text replacement
    - Font encoding handling
    - Kerning preservation
    """
    
    def __init__(self, doc: fitz.Document):
        self.doc = doc
        self.font_cache: Dict[str, FontInfo] = {}
    
    def get_page_streams(self, page_num: int) -> List[Tuple[int, bytes]]:
        """
        Get all content streams for a page.
        
        Returns list of (xref, decompressed_bytes) tuples.
        """
        page = self.doc[page_num]
        streams = []
        
        # Get content stream references
        xref = page.xref
        contents = self.doc.xref_get_key(xref, "Contents")
        
        if not contents[0]:
            return streams
        
        contents_value = contents[1]
        
        # Parse content reference(s)
        if contents_value.startswith("["):
            # Array of references
            refs = self._parse_array_refs(contents_value)
            for ref in refs:
                stream_bytes = self._get_stream_bytes(ref)
                if stream_bytes:
                    streams.append((ref, stream_bytes))
        else:
            # Single reference
            match = re.search(r'(\d+)\s+\d+\s+R', contents_value)
            if match:
                ref = int(match.group(1))
                stream_bytes = self._get_stream_bytes(ref)
                if stream_bytes:
                    streams.append((ref, stream_bytes))
        
        return streams
    
    def _parse_array_refs(self, array_str: str) -> List[int]:
        """Parse array of object references"""
        refs = []
        for match in re.finditer(r'(\d+)\s+\d+\s+R', array_str):
            refs.append(int(match.group(1)))
        return refs
    
    def _get_stream_bytes(self, xref: int) -> Optional[bytes]:
        """Get decompressed stream bytes for an xref"""
        try:
            # Read raw stream
            stream = self.doc.xref_stream(xref)
            return stream  # Already decompressed by PyMuPDF
        except:
            return None
    
    def extract_text_operators(
        self,
        page_num: int
    ) -> List[TextShowOperator]:
        """
        Extract all text showing operators from a page.
        
        Returns complete information for each text operation.
        """
        streams = self.get_page_streams(page_num)
        operators = []
        
        # Track graphics state
        current_font = None
        current_font_size = 12.0
        current_color = (0, 0, 0)
        text_matrix = [1, 0, 0, 1, 0, 0]
        line_matrix = [1, 0, 0, 1, 0, 0]
        
        for stream_idx, (xref, stream_bytes) in enumerate(streams):
            parser = ContentStreamParser(stream_bytes)
            content_ops = parser.parse()
            
            in_text_object = False
            
            for op in content_ops:
                # Track BT/ET
                if op.operator == 'BT':
                    in_text_object = True
                    text_matrix = [1, 0, 0, 1, 0, 0]
                    line_matrix = [1, 0, 0, 1, 0, 0]
                    continue
                    
                if op.operator == 'ET':
                    in_text_object = False
                    continue
                
                # Track font changes
                if op.operator == 'Tf' and len(op.operands) >= 2:
                    font_name = op.operands[0]
                    if isinstance(font_name, str):
                        current_font = font_name.lstrip('/')
                    current_font_size = float(op.operands[1])
                    continue
                
                # Track text matrix
                if op.operator == 'Tm' and len(op.operands) >= 6:
                    text_matrix = [float(x) for x in op.operands[:6]]
                    line_matrix = text_matrix.copy()
                    continue
                
                # Track position changes
                if op.operator in ('Td', 'TD') and len(op.operands) >= 2:
                    tx, ty = float(op.operands[0]), float(op.operands[1])
                    line_matrix = self._translate_matrix(line_matrix, tx, ty)
                    text_matrix = line_matrix.copy()
                    continue
                
                # Track color (stroke and fill)
                if op.operator == 'rg' and len(op.operands) >= 3:
                    current_color = tuple(float(x) for x in op.operands[:3])
                    continue
                
                # Text showing operators
                if op.operator in ('Tj', 'TJ', "'", '"'):
                    text_op = self._build_text_operator(
                        op=op,
                        font_name=current_font or "Unknown",
                        font_size=current_font_size,
                        color=current_color,
                        text_matrix=text_matrix.copy(),
                        stream_idx=stream_idx,
                        page_num=page_num
                    )
                    if text_op:
                        operators.append(text_op)
        
        return operators
    
    def _translate_matrix(
        self,
        matrix: List[float],
        tx: float,
        ty: float
    ) -> List[float]:
        """Apply translation to matrix"""
        return [
            matrix[0], matrix[1],
            matrix[2], matrix[3],
            matrix[4] + tx * matrix[0] + ty * matrix[2],
            matrix[5] + tx * matrix[1] + ty * matrix[3],
        ]
    
    def _build_text_operator(
        self,
        op: ContentStreamOperator,
        font_name: str,
        font_size: float,
        color: Tuple[float, float, float],
        text_matrix: List[float],
        stream_idx: int,
        page_num: int
    ) -> Optional[TextShowOperator]:
        """Build TextShowOperator from parsed operator"""
        
        if op.operator == 'Tj':
            if not op.operands:
                return None
            text_bytes = self._extract_string_bytes(op.operands[-1])
            decoded = self._decode_text(text_bytes, font_name, page_num)
            
            return TextShowOperator(
                operator_type='Tj',
                text_bytes=text_bytes,
                decoded_text=decoded,
                font_name=font_name,
                font_size=font_size,
                position=(text_matrix[4], text_matrix[5]),
                color=color,
                text_matrix=text_matrix,
                stream_index=stream_idx,
                start_offset=op.start_offset,
                end_offset=op.end_offset,
            )
        
        elif op.operator == 'TJ':
            if not op.operands:
                return None
            
            # TJ takes an array of strings and positioning adjustments
            array = op.operands[-1] if isinstance(op.operands[-1], list) else []
            tj_array = []
            all_text = b''
            
            for item in array:
                if isinstance(item, bytes):
                    tj_array.append((item, 0))
                    all_text += self._extract_string_bytes(item)
                elif isinstance(item, (int, float)):
                    if tj_array:
                        # Add adjustment to previous item
                        prev_bytes, _ = tj_array[-1]
                        tj_array[-1] = (prev_bytes, float(item))
            
            decoded = self._decode_text(all_text, font_name, page_num)
            
            return TextShowOperator(
                operator_type='TJ',
                text_bytes=all_text,
                decoded_text=decoded,
                font_name=font_name,
                font_size=font_size,
                position=(text_matrix[4], text_matrix[5]),
                color=color,
                text_matrix=text_matrix,
                tj_array=tj_array,
                stream_index=stream_idx,
                start_offset=op.start_offset,
                end_offset=op.end_offset,
            )
        
        return None
    
    def _extract_string_bytes(self, operand: Any) -> bytes:
        """Extract bytes from string operand"""
        if isinstance(operand, bytes):
            # Literal string (...)
            if operand.startswith(b'(') and operand.endswith(b')'):
                return self._decode_literal_string(operand[1:-1])
            # Hex string <...>
            if operand.startswith(b'<') and operand.endswith(b'>'):
                return self._decode_hex_string(operand[1:-1])
            return operand
        return b''
    
    def _decode_literal_string(self, data: bytes) -> bytes:
        """Decode PDF literal string with escape sequences"""
        result = bytearray()
        i = 0
        
        while i < len(data):
            if data[i:i+1] == b'\\':
                if i + 1 >= len(data):
                    break
                
                next_char = data[i+1:i+2]
                
                # Octal escape
                if next_char and next_char[0] in b'01234567':
                    octal = b''
                    for j in range(3):
                        if i + 1 + j < len(data) and data[i+1+j:i+2+j][0] in b'01234567':
                            octal += data[i+1+j:i+2+j]
                        else:
                            break
                    result.append(int(octal, 8))
                    i += 1 + len(octal)
                    continue
                
                # Named escapes
                escape_map = {
                    b'n': b'\n',
                    b'r': b'\r',
                    b't': b'\t',
                    b'b': b'\b',
                    b'f': b'\f',
                    b'(': b'(',
                    b')': b')',
                    b'\\': b'\\',
                }
                
                if next_char in escape_map:
                    result.extend(escape_map[next_char])
                    i += 2
                    continue
                
                # Line continuation
                if next_char in (b'\r', b'\n'):
                    i += 2
                    if next_char == b'\r' and i < len(data) and data[i:i+1] == b'\n':
                        i += 1
                    continue
                
                # Unknown escape, keep the backslash
                result.append(data[i])
                i += 1
            else:
                result.append(data[i])
                i += 1
        
        return bytes(result)
    
    def _decode_hex_string(self, data: bytes) -> bytes:
        """Decode PDF hex string"""
        # Remove whitespace
        hex_str = b''.join(data.split())
        
        # Pad with 0 if odd length
        if len(hex_str) % 2 == 1:
            hex_str += b'0'
        
        try:
            return bytes.fromhex(hex_str.decode('ascii'))
        except:
            return b''
    
    def _decode_text(
        self,
        text_bytes: bytes,
        font_name: str,
        page_num: int
    ) -> str:
        """Decode text bytes using font encoding"""
        # Get font info
        font_info = self._get_font_info(font_name, page_num)
        
        if font_info and font_info.to_unicode:
            # Use ToUnicode map
            result = []
            i = 0
            byte_len = font_info.byte_length
            
            while i < len(text_bytes):
                code = int.from_bytes(
                    text_bytes[i:i+byte_len],
                    'big'
                ) if byte_len > 1 else text_bytes[i]
                
                if code in font_info.to_unicode:
                    result.append(font_info.to_unicode[code])
                else:
                    result.append(chr(code) if code < 256 else '?')
                
                i += byte_len
            
            return ''.join(result)
        
        # Fall back to latin-1 decoding
        try:
            return text_bytes.decode('latin-1')
        except:
            return text_bytes.decode('utf-8', errors='replace')
    
    def _get_font_info(self, font_name: str, page_num: int) -> Optional[FontInfo]:
        """Get font information for encoding/decoding"""
        cache_key = f"{page_num}:{font_name}"
        
        if cache_key in self.font_cache:
            return self.font_cache[cache_key]
        
        page = self.doc[page_num]
        
        # Try to extract font info from page resources
        fonts = page.get_fonts()
        
        for font_entry in fonts:
            # font_entry: (xref, ext, type, basefont, name, encoding)
            if len(font_entry) > 4 and font_entry[4] == font_name:
                font_xref = font_entry[0]
                
                # Parse font object
                font_info = self._parse_font_object(font_xref)
                if font_info:
                    self.font_cache[cache_key] = font_info
                    return font_info
        
        return None
    
    def _parse_font_object(self, xref: int) -> Optional[FontInfo]:
        """Parse PDF font object to extract encoding info"""
        try:
            font_dict = self.doc.xref_object(xref)
            
            # Extract base font name
            base_font_match = re.search(r'/BaseFont\s*/(\S+)', font_dict)
            base_font = base_font_match.group(1) if base_font_match else "Unknown"
            
            # Extract encoding
            encoding_match = re.search(r'/Encoding\s*/(\S+)', font_dict)
            encoding = encoding_match.group(1) if encoding_match else "WinAnsiEncoding"
            
            # Check if CID font
            is_cid = '/CIDFont' in font_dict or '/DescendantFonts' in font_dict
            
            # Try to get ToUnicode CMap
            to_unicode = None
            tounicode_match = re.search(r'/ToUnicode\s+(\d+)\s+\d+\s+R', font_dict)
            if tounicode_match:
                tounicode_xref = int(tounicode_match.group(1))
                to_unicode = self._parse_tounicode(tounicode_xref)
            
            return FontInfo(
                name=base_font,
                base_font=base_font,
                encoding=encoding,
                to_unicode=to_unicode,
                reverse_unicode=self._build_reverse_map(to_unicode) if to_unicode else None,
                is_cid_font=is_cid,
                byte_length=2 if is_cid else 1,
            )
            
        except Exception as e:
            logger.warning("Failed to parse font", xref=xref, error=str(e))
            return None
    
    def _parse_tounicode(self, xref: int) -> Optional[Dict[int, str]]:
        """Parse ToUnicode CMap stream"""
        try:
            cmap_stream = self.doc.xref_stream(xref)
            cmap_text = cmap_stream.decode('latin-1', errors='replace')
            
            unicode_map = {}
            
            # Parse bfchar entries: <code> <unicode>
            for match in re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', cmap_text):
                code = int(match.group(1), 16)
                unicode_hex = match.group(2)
                
                # Decode unicode value(s)
                unicode_bytes = bytes.fromhex(unicode_hex)
                if len(unicode_bytes) >= 2:
                    # UTF-16BE
                    unicode_str = unicode_bytes.decode('utf-16-be', errors='replace')
                else:
                    unicode_str = chr(int(unicode_hex, 16))
                
                unicode_map[code] = unicode_str
            
            # Parse bfrange entries: <start> <end> <unicode_start>
            for match in re.finditer(
                r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',
                cmap_text
            ):
                start = int(match.group(1), 16)
                end = int(match.group(2), 16)
                unicode_start = int(match.group(3), 16)
                
                for i, code in enumerate(range(start, end + 1)):
                    unicode_map[code] = chr(unicode_start + i)
            
            return unicode_map if unicode_map else None
            
        except Exception as e:
            logger.warning("Failed to parse ToUnicode", xref=xref, error=str(e))
            return None
    
    def _build_reverse_map(
        self,
        to_unicode: Dict[int, str]
    ) -> Dict[str, bytes]:
        """Build reverse unicode map for encoding"""
        reverse = {}
        for code, char in to_unicode.items():
            if char not in reverse:
                # Determine byte length from code
                if code > 0xFFFF:
                    byte_len = 4
                elif code > 0xFF:
                    byte_len = 2
                else:
                    byte_len = 1
                reverse[char] = code.to_bytes(byte_len, 'big')
        return reverse
    
    def replace_text(
        self,
        page_num: int,
        text_op: TextShowOperator,
        new_text: str
    ) -> bool:
        """
        Replace text in content stream.
        
        Performs true byte-level replacement.
        
        Args:
            page_num: Page number (0-based)
            text_op: Text operator to replace
            new_text: New text content
            
        Returns:
            True if successful
        """
        try:
            # Get streams
            streams = self.get_page_streams(page_num)
            if text_op.stream_index >= len(streams):
                return False
            
            xref, stream_bytes = streams[text_op.stream_index]
            
            # Encode new text
            new_bytes = self._encode_text(
                new_text,
                text_op.font_name,
                page_num
            )
            
            # Build replacement
            if text_op.operator_type == 'Tj':
                # Simple replacement
                old_segment = stream_bytes[text_op.start_offset:text_op.end_offset]
                new_segment = self._build_tj_operator(new_bytes, old_segment)
            
            elif text_op.operator_type == 'TJ':
                # TJ requires preserving kerning structure
                old_segment = stream_bytes[text_op.start_offset:text_op.end_offset]
                new_segment = self._build_tj_array_operator(
                    new_bytes,
                    text_op.tj_array or [],
                    old_segment
                )
            
            else:
                return False
            
            # Apply replacement
            new_stream = (
                stream_bytes[:text_op.start_offset] +
                new_segment +
                stream_bytes[text_op.end_offset:]
            )
            
            # Update stream in PDF
            self._update_stream(xref, new_stream)
            
            return True
            
        except Exception as e:
            logger.error("Text replacement failed", error=str(e))
            return False
    
    def _encode_text(
        self,
        text: str,
        font_name: str,
        page_num: int
    ) -> bytes:
        """Encode text using font encoding"""
        font_info = self._get_font_info(font_name, page_num)
        
        if font_info and font_info.reverse_unicode:
            # Use reverse unicode map
            result = bytearray()
            for char in text:
                if char in font_info.reverse_unicode:
                    result.extend(font_info.reverse_unicode[char])
                else:
                    # Fall back to latin-1
                    result.append(ord(char) if ord(char) < 256 else ord('?'))
            return bytes(result)
        
        # Fall back to latin-1 encoding
        return text.encode('latin-1', errors='replace')
    
    def _build_tj_operator(
        self,
        text_bytes: bytes,
        original: bytes
    ) -> bytes:
        """Build Tj operator with encoded text"""
        # Check if original used hex string
        original_str = original.decode('latin-1', errors='replace')
        
        if '<' in original_str:
            # Use hex string format
            hex_str = text_bytes.hex().upper()
            return f"<{hex_str}> Tj".encode('latin-1')
        else:
            # Use literal string format
            escaped = self._escape_literal_string(text_bytes)
            return f"({escaped}) Tj".encode('latin-1')
    
    def _build_tj_array_operator(
        self,
        text_bytes: bytes,
        original_tj_array: List[Tuple[bytes, float]],
        original: bytes
    ) -> bytes:
        """Build TJ operator preserving kerning"""
        # For simplicity, if lengths match, distribute bytes across array
        # Otherwise, use single string
        
        total_original_len = sum(len(b) for b, _ in original_tj_array)
        
        if len(text_bytes) == total_original_len and original_tj_array:
            # Distribute across array elements
            parts = []
            pos = 0
            
            for orig_bytes, adjustment in original_tj_array:
                chunk = text_bytes[pos:pos + len(orig_bytes)]
                pos += len(orig_bytes)
                
                # Escape chunk
                escaped = self._escape_literal_string(chunk)
                parts.append(f"({escaped})")
                
                if adjustment != 0:
                    parts.append(str(int(adjustment)))
            
            return f"[{' '.join(parts)}] TJ".encode('latin-1')
        
        else:
            # Use single string
            escaped = self._escape_literal_string(text_bytes)
            return f"[({escaped})] TJ".encode('latin-1')
    
    def _escape_literal_string(self, data: bytes) -> str:
        """Escape bytes for PDF literal string"""
        result = []
        for b in data:
            if b == ord('('):
                result.append('\\(')
            elif b == ord(')'):
                result.append('\\)')
            elif b == ord('\\'):
                result.append('\\\\')
            elif b == ord('\n'):
                result.append('\\n')
            elif b == ord('\r'):
                result.append('\\r')
            elif b == ord('\t'):
                result.append('\\t')
            elif 32 <= b < 127:
                result.append(chr(b))
            else:
                result.append(f'\\{b:03o}')
        return ''.join(result)
    
    def _update_stream(self, xref: int, new_content: bytes) -> None:
        """Update content stream in PDF"""
        # Compress the new content
        compressed = zlib.compress(new_content)
        
        # Update the stream
        self.doc.update_stream(xref, compressed)


# Export
__all__ = [
    'ContentStreamParser',
    'TrueContentStreamEditor',
    'ContentStreamOperator',
    'TextShowOperator',
    'FontInfo',
]
