"""
GotuPDF - Encryption Handler

Handles PDF encryption and decryption using qpdf for
advanced encryption methods.

Copyright (c) 2024 GotuPDF
"""

import asyncio
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum
import structlog

logger = structlog.get_logger(__name__)


class EncryptionMethod(str, Enum):
    """PDF encryption methods"""
    RC4_40 = "rc4_40"
    RC4_128 = "rc4_128"
    AES_128 = "aes_128"
    AES_256 = "aes_256"


class Permission(str, Enum):
    """PDF permission flags"""
    PRINT = "print"
    MODIFY = "modify"
    COPY = "copy"
    ANNOTATE = "annotate"
    FILL_FORMS = "fill_forms"
    EXTRACT = "extract"
    ASSEMBLE = "assemble"
    PRINT_HIGH = "print_high"


@dataclass
class EncryptionInfo:
    """Information about PDF encryption"""
    is_encrypted: bool
    method: Optional[EncryptionMethod]
    has_user_password: bool
    has_owner_password: bool
    permissions: Dict[Permission, bool]
    key_length: int = 256


@dataclass
class DecryptionResult:
    """Result of decryption operation"""
    success: bool
    pdf_bytes: Optional[bytes]
    original_info: Optional[EncryptionInfo]
    message: str


@dataclass
class EncryptionResult:
    """Result of encryption operation"""
    success: bool
    pdf_bytes: Optional[bytes]
    message: str


class QPDFHandler:
    """
    Handler for qpdf command-line operations.
    
    qpdf is used for:
    - Advanced decryption
    - Re-encryption with specific settings
    - Linearization (web optimization)
    - PDF/A compatibility
    """
    
    def __init__(self):
        self._qpdf_available: Optional[bool] = None
        self._qpdf_path: Optional[str] = None
    
    def is_available(self) -> bool:
        """Check if qpdf is available on the system"""
        if self._qpdf_available is not None:
            return self._qpdf_available
        
        try:
            result = subprocess.run(
                ["qpdf", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            self._qpdf_available = result.returncode == 0
            if self._qpdf_available:
                self._qpdf_path = "qpdf"
                logger.info("qpdf available", version=result.stdout.strip())
        except (subprocess.SubprocessError, FileNotFoundError):
            self._qpdf_available = False
            logger.warning("qpdf not available")
        
        return self._qpdf_available
    
    async def decrypt(
        self,
        pdf_bytes: bytes,
        password: Optional[str] = None,
    ) -> DecryptionResult:
        """
        Decrypt PDF using qpdf.
        
        qpdf can handle encryption methods that pure Python
        libraries may not support.
        """
        if not self.is_available():
            return DecryptionResult(
                success=False,
                pdf_bytes=None,
                original_info=None,
                message="qpdf is not available on this system"
            )
        
        temp_dir = Path(tempfile.mkdtemp(prefix="gotupdf_decrypt_"))
        
        try:
            input_path = temp_dir / "input.pdf"
            output_path = temp_dir / "decrypted.pdf"
            
            # Write input file
            input_path.write_bytes(pdf_bytes)
            
            # Build command
            cmd = [
                "qpdf",
                "--decrypt",
            ]
            
            if password:
                cmd.extend(["--password=" + password])
            
            cmd.extend([
                str(input_path),
                str(output_path),
            ])
            
            # Run qpdf
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60,
            )
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='replace')
                return DecryptionResult(
                    success=False,
                    pdf_bytes=None,
                    original_info=None,
                    message=f"Decryption failed: {error_msg}"
                )
            
            # Read decrypted PDF
            decrypted_bytes = output_path.read_bytes()
            
            # Get original encryption info
            encryption_info = await self._get_encryption_info(input_path, password)
            
            return DecryptionResult(
                success=True,
                pdf_bytes=decrypted_bytes,
                original_info=encryption_info,
                message="Decryption successful"
            )
            
        except asyncio.TimeoutError:
            return DecryptionResult(
                success=False,
                pdf_bytes=None,
                original_info=None,
                message="Decryption timed out"
            )
        except Exception as e:
            logger.error("Decryption failed", error=str(e))
            return DecryptionResult(
                success=False,
                pdf_bytes=None,
                original_info=None,
                message=f"Decryption error: {str(e)}"
            )
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    async def encrypt(
        self,
        pdf_bytes: bytes,
        user_password: str = "",
        owner_password: str = "",
        method: EncryptionMethod = EncryptionMethod.AES_256,
        permissions: Optional[List[Permission]] = None,
    ) -> EncryptionResult:
        """
        Encrypt PDF using qpdf.
        
        Args:
            pdf_bytes: Unencrypted PDF bytes
            user_password: Password to open PDF (can be empty)
            owner_password: Password to modify permissions
            method: Encryption method to use
            permissions: List of permissions to grant
        """
        if not self.is_available():
            return EncryptionResult(
                success=False,
                pdf_bytes=None,
                message="qpdf is not available"
            )
        
        temp_dir = Path(tempfile.mkdtemp(prefix="gotupdf_encrypt_"))
        
        try:
            input_path = temp_dir / "input.pdf"
            output_path = temp_dir / "encrypted.pdf"
            
            # Write input file
            input_path.write_bytes(pdf_bytes)
            
            # Determine key length
            if method == EncryptionMethod.AES_256:
                key_length = "256"
            elif method in (EncryptionMethod.AES_128, EncryptionMethod.RC4_128):
                key_length = "128"
            else:
                key_length = "40"
            
            # Build command
            cmd = [
                "qpdf",
                "--encrypt",
                user_password,
                owner_password,
                key_length,
            ]
            
            # Add permissions
            default_permissions = [
                Permission.PRINT,
                Permission.COPY,
                Permission.ANNOTATE,
            ]
            
            effective_permissions = permissions or default_permissions
            
            for perm in Permission:
                enabled = perm in effective_permissions
                perm_arg = f"--{perm.value}={'y' if enabled else 'n'}"
                cmd.append(perm_arg)
            
            # Use AES if requested
            if method in (EncryptionMethod.AES_128, EncryptionMethod.AES_256):
                cmd.append("--use-aes=y")
            
            cmd.append("--")
            cmd.extend([str(input_path), str(output_path)])
            
            # Run qpdf
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60,
            )
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='replace')
                return EncryptionResult(
                    success=False,
                    pdf_bytes=None,
                    message=f"Encryption failed: {error_msg}"
                )
            
            # Read encrypted PDF
            encrypted_bytes = output_path.read_bytes()
            
            return EncryptionResult(
                success=True,
                pdf_bytes=encrypted_bytes,
                message="Encryption successful"
            )
            
        except asyncio.TimeoutError:
            return EncryptionResult(
                success=False,
                pdf_bytes=None,
                message="Encryption timed out"
            )
        except Exception as e:
            logger.error("Encryption failed", error=str(e))
            return EncryptionResult(
                success=False,
                pdf_bytes=None,
                message=f"Encryption error: {str(e)}"
            )
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    async def _get_encryption_info(
        self,
        pdf_path: Path,
        password: Optional[str] = None,
    ) -> Optional[EncryptionInfo]:
        """Get encryption information from PDF using qpdf"""
        try:
            cmd = ["qpdf", "--show-encryption"]
            
            if password:
                cmd.extend(["--password=" + password])
            
            cmd.append(str(pdf_path))
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            stdout, stderr = await process.communicate()
            output = stdout.decode('utf-8', errors='replace')
            
            # Parse output
            is_encrypted = "not encrypted" not in output.lower()
            
            # Determine method
            method = None
            if "AES (256-bit)" in output:
                method = EncryptionMethod.AES_256
            elif "AES (128-bit)" in output:
                method = EncryptionMethod.AES_128
            elif "RC4 (128-bit)" in output:
                method = EncryptionMethod.RC4_128
            elif "RC4 (40-bit)" in output:
                method = EncryptionMethod.RC4_40
            
            # Parse permissions
            permissions = {}
            for perm in Permission:
                perm_name = perm.value.replace("_", " ")
                permissions[perm] = f"{perm_name}: allowed" in output.lower()
            
            return EncryptionInfo(
                is_encrypted=is_encrypted,
                method=method,
                has_user_password="user password" in output.lower(),
                has_owner_password="owner password" in output.lower(),
                permissions=permissions,
                key_length=256 if method == EncryptionMethod.AES_256 else 128,
            )
            
        except Exception as e:
            logger.warning("Failed to get encryption info", error=str(e))
            return None
    
    async def linearize(self, pdf_bytes: bytes) -> bytes:
        """
        Linearize PDF for fast web viewing.
        
        Linearization enables byte-serving so users can view
        the first page while the rest loads.
        """
        if not self.is_available():
            return pdf_bytes  # Return unchanged if qpdf not available
        
        temp_dir = Path(tempfile.mkdtemp(prefix="gotupdf_linearize_"))
        
        try:
            input_path = temp_dir / "input.pdf"
            output_path = temp_dir / "linearized.pdf"
            
            input_path.write_bytes(pdf_bytes)
            
            cmd = [
                "qpdf",
                "--linearize",
                str(input_path),
                str(output_path),
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            await process.communicate()
            
            if output_path.exists():
                return output_path.read_bytes()
            
            return pdf_bytes
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


# Singleton instance
qpdf_handler = QPDFHandler()


__all__ = [
    "QPDFHandler",
    "qpdf_handler",
    "EncryptionMethod",
    "Permission",
    "EncryptionInfo",
    "DecryptionResult",
    "EncryptionResult",
]
