# PDF Tools Installation Guide

This document provides installation instructions for the external dependencies required by the Protect PDF and PDF to PPT systems.

## Required Dependencies

### 1. QPDF (for Protect PDF)

QPDF is used for AES-256 bit PDF encryption.

#### Windows

**Via Windows Package Manager (winget):**
```powershell
winget install QPDF.QPDF
```

**Via Chocolatey:**
```powershell
choco install qpdf
```

**Manual Installation:**
1. Download from: https://github.com/qpdf/qpdf/releases
2. Run the installer
3. Default location: `C:\Program Files\qpdf 12.3.2\bin\qpdf.exe`

#### macOS

```bash
brew install qpdf
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get install qpdf
```

#### Linux (RHEL/CentOS)

```bash
sudo yum install qpdf
```

---

### 2. Poppler Utils (for PDF to PPT)

Poppler provides `pdftoppm` and `pdfinfo` for high-quality PDF to image conversion.

#### Windows

**Via MiKTeX (Recommended):**
MiKTeX includes Poppler tools. Install from: https://miktex.org/download

**Via Chocolatey:**
```powershell
choco install poppler
```

**Manual Installation:**
1. Download from: https://github.com/oschwartz10612/poppler-windows/releases
2. Extract to a folder (e.g., `C:\poppler`)
3. Add `C:\poppler\bin` to your system PATH

#### macOS

```bash
brew install poppler
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get install poppler-utils
```

#### Linux (RHEL/CentOS)

```bash
sudo yum install poppler-utils
```

---

## Verification

After installation, verify the tools are working:

```powershell
# Check QPDF
qpdf --version

# Check Poppler
pdftoppm -v
pdfinfo -v
```

Expected output should show version numbers for each tool.

---

## Environment Variables

The system automatically detects tools in common installation paths. If you install in a custom location, you can set environment variables:

```powershell
# Windows PowerShell
$env:QPDF_PATH = "C:\path\to\qpdf.exe"
$env:PDFTOPPM_PATH = "C:\path\to\pdftoppm.exe"
```

```bash
# Linux/macOS
export QPDF_PATH=/path/to/qpdf
export PDFTOPPM_PATH=/path/to/pdftoppm
```

---

## Troubleshooting

### QPDF Not Found

If you see "QPDF is not installed" error:

1. Verify installation: `qpdf --version`
2. Check PATH environment variable includes QPDF bin directory
3. Restart your terminal/IDE after installation
4. On Windows, you may need to restart the Node.js server

### Poppler Not Found

If you see "pdftoppm is not installed" error:

1. Verify installation: `pdftoppm -v`
2. Check PATH environment variable includes Poppler bin directory
3. On Windows via MiKTeX, tools are at: `%LOCALAPPDATA%\Programs\MiKTeX\miktex\bin\x64\`

### OpenSSL Errors

The new implementation does NOT use Node.js crypto for PDF encryption. All encryption is handled by QPDF externally, completely avoiding OpenSSL compatibility issues with Node 18+.

---

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Operating System**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- **Memory**: 4GB RAM minimum (8GB recommended for large PDFs)
- **Disk Space**: 100MB for tools + temp space for processing

---

## Production Deployment

### Vercel

Add the tools as build dependencies or use a custom runtime with the tools pre-installed.

### Docker

Example Dockerfile additions:

```dockerfile
# Install QPDF and Poppler
RUN apt-get update && apt-get install -y \
    qpdf \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
```

### AWS Lambda

Use a Lambda Layer with the compiled binaries:
- QPDF: https://github.com/justsml/qpdf-lambda-layer
- Poppler: https://github.com/nicecai/poppler-lambda-layer
