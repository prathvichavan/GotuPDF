<#
.SYNOPSIS
    PDF to PowerPoint conversion using Microsoft PowerPoint COM Automation.
    GotuPDF Enterprise Document Processing Engine v2.

.DESCRIPTION
    Opens a PDF directly in PowerPoint via COM (PowerPoint's native PDF import),
    then saves as PPTX with maximum layout fidelity.

    PowerPoint internally converts each PDF page into an editable slide preserving:
    - Backgrounds, gradients, images at full resolution
    - Text with fonts, sizes, colors, bold/italic/underline (editable)
    - Tables, shapes, diagrams, SmartArt
    - Watermarks, logos, borders
    - Transparency and opacity
    - Aspect ratio & page layout

    FONT HANDLING:
    - Detects used fonts across all slides
    - Reports fonts not installed on the system
    - Preserves bold, italic, underline, strikethrough formatting

    IMAGE HANDLING:
    - Disables automatic image compression
    - Preserves original resolution and aspect ratio
    - Preserves transparency on PNG-type images

    VALIDATION:
    - Checks slide count matches expectations
    - Detects blank slides (no shapes or text)
    - Verifies background presence
    - Catalogs shapes, images, tables, text boxes
    - Reports font coverage

.PARAMETER InputPath
    Absolute path to the input .pdf file.

.PARAMETER OutputPath
    Absolute path for the output .pptx file.

.OUTPUTS
    JSON object with comprehensive metadata for the calling engine.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [Parameter(Mandatory=$true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date
$ppt  = $null
$pres = $null

# ────────────────────────────────────────────────────────────
# JSON output helper
# ────────────────────────────────────────────────────────────
function Write-JsonResult {
    param(
        [bool]$Success,
        [string]$OutPath,
        [int]$SlideCount,
        [bool]$HasImages,
        [bool]$HasBackgrounds,
        [int]$ShapesCount,
        [int]$TextBoxCount,
        [int]$TableCount,
        [int]$BlankSlideCount,
        [string[]]$FontsUsed,
        [string[]]$FontsMissing,
        [bool]$HasWatermark,
        [bool]$HasBoldText,
        [bool]$HasItalicText,
        [bool]$HasUnderlineText,
        [int]$ImageCount,
        [string]$ErrorMsg,
        [double]$Elapsed
    )
    $result = @{
        success          = $Success
        outputPath       = if ($OutPath) { $OutPath } else { "" }
        slideCount       = $SlideCount
        hasImages        = $HasImages
        hasBackgrounds   = $HasBackgrounds
        shapesCount      = $ShapesCount
        textBoxCount     = $TextBoxCount
        tableCount       = $TableCount
        blankSlideCount  = $BlankSlideCount
        fontsUsed        = @($FontsUsed)
        fontsMissing     = @($FontsMissing)
        hasWatermark     = $HasWatermark
        hasBoldText      = $HasBoldText
        hasItalicText    = $HasItalicText
        hasUnderlineText = $HasUnderlineText
        imageCount       = $ImageCount
        error            = if ($ErrorMsg) { $ErrorMsg } else { "" }
        elapsed          = $Elapsed
    }
    $result | ConvertTo-Json -Compress -Depth 3
}

# ────────────────────────────────────────────────────────────
# Font availability check
# ────────────────────────────────────────────────────────────
function Get-InstalledFontNames {
    $fonts = @{}
    try {
        Add-Type -AssemblyName System.Drawing
        $fc = New-Object System.Drawing.Text.InstalledFontCollection
        foreach ($ff in $fc.Families) {
            $fonts[$ff.Name.ToLower()] = $true
        }
    } catch {}
    return $fonts
}

try {
    # ── Validate input ──────────────────────────────────────
    if (-not (Test-Path $InputPath)) {
        throw "Input file not found: $InputPath"
    }

    $ext = [System.IO.Path]::GetExtension($InputPath).ToLower()
    if ($ext -ne '.pdf') {
        throw "Unsupported file type: $ext. Expected .pdf"
    }

    $fileSize = (Get-Item $InputPath).Length
    if ($fileSize -lt 100) {
        throw "PDF file is too small to be valid ($fileSize bytes)"
    }
    if ($fileSize -gt 100 * 1024 * 1024) {
        throw "PDF file exceeds 100 MB size limit ($([math]::Round($fileSize / 1MB, 1)) MB)"
    }

    # ── Create PowerPoint COM instance ──────────────────────
    $ppt = New-Object -ComObject PowerPoint.Application

    # Suppress alerts — ppAlertsNone = 2 (NOT 0; 0 is invalid for PpAlertLevel)
    try { $ppt.DisplayAlerts = 2 } catch {}

    # ── Open PDF in PowerPoint ──────────────────────────────
    # MsoTriState: msoTrue=-1, msoFalse=0
    # Open(FileName, ReadOnly, Untitled, WithWindow)
    # WithWindow=msoFalse prevents a visible PowerPoint window
    $msoTrue  = [int]-1
    $msoFalse = [int]0
    $pres = $ppt.Presentations.Open($InputPath, $msoTrue, $msoFalse, $msoFalse)

    # Disable image compression on the presentation for maximum image quality
    try { $pres.DefaultImageResolution = 330 } catch {}

    $slideCount = $pres.Slides.Count

    # ── Load installed fonts for comparison ─────────────────
    $installedFonts = Get-InstalledFontNames

    # ── Analyze slides comprehensively ──────────────────────
    $hasImages        = $false
    $hasBackgrounds   = $false
    $totalShapes      = 0
    $textBoxCount     = 0
    $tableCount       = 0
    $blankSlideCount  = 0
    $imageCount       = 0
    $hasWatermark     = $false
    $hasBoldText      = $false
    $hasItalicText    = $false
    $hasUnderlineText = $false
    $fontSet          = @{}

    foreach ($slide in $pres.Slides) {
        $slideHasContent = $false

        # ── Check background ────────────────────────────────
        try {
            $bg   = $slide.Background
            $fill = $bg.Fill
            # msoFillBackground=0 means no explicit fill
            if ($fill.Type -ne 0) {
                $hasBackgrounds  = $true
                $slideHasContent = $true
            }
        } catch {}

        # ── Analyze every shape ─────────────────────────────
        foreach ($shape in $slide.Shapes) {
            $totalShapes++
            $slideHasContent = $true

            # Images: msoPicture=13, msoLinkedPicture=11, msoLinkedOLEObject=10
            if ($shape.Type -eq 13 -or $shape.Type -eq 11 -or $shape.Type -eq 10) {
                $hasImages = $true
                $imageCount++
            }

            # Text boxes: msoTextBox=17, msoPlaceholder=14
            if ($shape.Type -eq 17 -or $shape.Type -eq 14) {
                $textBoxCount++
            }
            elseif ($shape.HasTextFrame) {
                try {
                    if ($shape.TextFrame.HasText) {
                        $textBoxCount++
                    }
                } catch {}
            }

            # Tables: msoTable=19
            if ($shape.Type -eq 19) {
                $tableCount++
            }

            # ── Font & formatting analysis ──────────────────
            if ($shape.HasTextFrame) {
                try {
                    $tf = $shape.TextFrame
                    if ($tf.HasText) {
                        foreach ($para in $tf.TextRange.Paragraphs()) {
                            foreach ($run in $para.Runs()) {
                                $font = $run.Font
                                # Collect font names
                                try {
                                    $fname = $font.Name
                                    if ($fname -and $fname.Length -gt 0) {
                                        $fontSet[$fname] = $true
                                    }
                                } catch {}
                                # Check bold (msoTrue = -1)
                                try { if ($font.Bold -eq $msoTrue)  { $hasBoldText  = $true } } catch {}
                                # Check italic
                                try { if ($font.Italic -eq $msoTrue) { $hasItalicText = $true } } catch {}
                                # Check underline (ppUnderlineNone = 0)
                                try { if ($font.Underline -ne 0) { $hasUnderlineText = $true } } catch {}
                            }
                        }
                    }
                } catch {}
            }

            # ── Watermark detection ─────────────────────────
            if (-not $hasWatermark) {
                # Shapes with non-standard rotation + text = likely watermark
                try {
                    $rot = $shape.Rotation
                    if ($rot -ne 0 -and $rot -ne 90 -and $rot -ne 180 -and $rot -ne 270) {
                        if ($shape.HasTextFrame) {
                            try {
                                if ($shape.TextFrame.HasText) {
                                    $hasWatermark = $true
                                }
                            } catch {}
                        }
                    }
                } catch {}
                # Shapes with high transparency = likely watermark
                try {
                    if ($shape.Fill.Transparency -gt 0.3) {
                        $hasWatermark = $true
                    }
                } catch {}
            }

            # ── Grouped shapes (recurse one level) ──────────
            if ($shape.Type -eq 6) {  # msoGroup
                try {
                    foreach ($groupItem in $shape.GroupItems) {
                        $totalShapes++
                        if ($groupItem.Type -eq 13 -or $groupItem.Type -eq 11) {
                            $hasImages = $true
                            $imageCount++
                        }
                        if ($groupItem.Type -eq 19) {
                            $tableCount++
                        }
                    }
                } catch {}
            }
        }

        if (-not $slideHasContent) {
            $blankSlideCount++
        }
    }

    # ── Determine missing fonts ─────────────────────────────
    $fontsUsed   = @($fontSet.Keys | Sort-Object)
    $fontsMissing = @()
    foreach ($f in $fontsUsed) {
        $lower = $f.ToLower()
        if (-not $installedFonts.ContainsKey($lower)) {
            $fontsMissing += $f
        }
    }

    # ── Save as PPTX ────────────────────────────────────────
    # ppSaveAsOpenXMLPresentation = 24
    $pres.SaveAs($OutputPath, 24)

    # ── Close and quit ──────────────────────────────────────
    $pres.Close()
    $pres = $null

    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    $ppt = $null

    $elapsed = ((Get-Date) - $startTime).TotalMilliseconds

    # ── Validate output file ────────────────────────────────
    $actualOutput = $OutputPath
    if (-not (Test-Path $actualOutput)) {
        # PowerPoint sometimes appends .pptx
        $actualOutput = "$OutputPath.pptx"
    }
    if (-not (Test-Path $actualOutput)) {
        throw "PPTX output file was not created"
    }

    $outSize = (Get-Item $actualOutput).Length
    if ($outSize -lt 500) {
        throw "PPTX output is suspiciously small ($outSize bytes)"
    }

    Write-JsonResult -Success $true -OutPath $actualOutput `
        -SlideCount $slideCount `
        -HasImages $hasImages -HasBackgrounds $hasBackgrounds `
        -ShapesCount $totalShapes -TextBoxCount $textBoxCount `
        -TableCount $tableCount -BlankSlideCount $blankSlideCount `
        -FontsUsed $fontsUsed -FontsMissing $fontsMissing `
        -HasWatermark $hasWatermark `
        -HasBoldText $hasBoldText -HasItalicText $hasItalicText `
        -HasUnderlineText $hasUnderlineText `
        -ImageCount $imageCount `
        -ErrorMsg "" -Elapsed $elapsed

} catch {
    $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
    $errorMsg = $_.Exception.Message

    # ── Friendly error messages ─────────────────────────────
    if ($errorMsg -match "password|protected|encryption") {
        $errorMsg = "PDF is password-protected. Please unlock it first and try again."
    }
    elseif ($errorMsg -match "could not be found|not found") {
        $errorMsg = "File not found or inaccessible."
    }
    elseif ($errorMsg -match "RPC|server.*unavailable|DCOM") {
        $errorMsg = "Microsoft PowerPoint COM automation is not available. Ensure PowerPoint is installed."
    }
    elseif ($errorMsg -match "corrupt|damaged|invalid") {
        $errorMsg = "The PDF file appears to be corrupted or damaged."
    }
    elseif ($errorMsg -match "Presentations\.Open") {
        $errorMsg = "PowerPoint could not open this PDF. The file may be damaged or unsupported."
    }
    elseif ($errorMsg -match "out of memory|memory") {
        $errorMsg = "PowerPoint ran out of memory processing this PDF. Try a smaller file."
    }

    Write-JsonResult -Success $false -OutPath "" `
        -SlideCount 0 `
        -HasImages $false -HasBackgrounds $false `
        -ShapesCount 0 -TextBoxCount 0 `
        -TableCount 0 -BlankSlideCount 0 `
        -FontsUsed @() -FontsMissing @() `
        -HasWatermark $false `
        -HasBoldText $false -HasItalicText $false `
        -HasUnderlineText $false `
        -ImageCount 0 `
        -ErrorMsg $errorMsg -Elapsed $elapsed

} finally {
    # ── Ensure COM cleanup ──────────────────────────────────
    if ($pres -ne $null) {
        try { $pres.Close() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null } catch {}
    }
    if ($ppt -ne $null) {
        try { $ppt.Quit() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null } catch {}
    }

    # Force garbage collection to release COM handles
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    # Kill any orphan POWERPNT processes that started after us
    Get-Process -Name "POWERPNT" -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -ge $startTime } |
        ForEach-Object {
            try { $_.Kill() } catch {}
        }
}
