<#
.SYNOPSIS
    PDF to Word conversion using Microsoft Word COM Automation.
    GotuPDF Enterprise Document Processing Engine.

.DESCRIPTION
    Opens a PDF directly in Word via COM (Word's internal PDF import engine),
    then saves as DOCX with maximum layout fidelity.
    Word internally converts PDF objects into editable Word elements preserving:
    - Text with fonts, sizes, colors
    - Tables with exact grid structure
    - Images at original resolution
    - Headers & Footers
    - Page layout & margins
    - Watermarks
    - Hyperlinks

.PARAMETER InputPath
    Absolute path to the input .pdf file.

.PARAMETER OutputPath
    Absolute path for the output .docx file.

.OUTPUTS
    JSON object with: success, outputPath, pageCount, imageCount, hasWatermark,
                      hasHeaders, hasFooters, tableCount, error, elapsed
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [Parameter(Mandatory=$true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date
$word = $null
$doc = $null

function Write-JsonResult {
    param($Success, $OutputPath, $PageCount, $ImageCount, $HasWatermark,
          $HasHeaders, $HasFooters, $TableCount, $ErrorMsg, $Elapsed)
    $result = @{
        success      = $Success
        outputPath   = $OutputPath
        pageCount    = $PageCount
        imageCount   = $ImageCount
        hasWatermark = $HasWatermark
        hasHeaders   = $HasHeaders
        hasFooters   = $HasFooters
        tableCount   = $TableCount
        error        = $ErrorMsg
        elapsed      = $Elapsed
    }
    $result | ConvertTo-Json -Compress
}

try {
    # Validate input
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

    # Create Word COM instance
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0  # wdAlertsNone
    $word.AutomationSecurity = 3  # msoAutomationSecurityForceDisable

    # Open PDF in Word — Word will internally convert it to editable document
    # Parameters: FileName, ConfirmConversions, ReadOnly, AddToRecentFiles
    # ConfirmConversions = $false suppresses the "Word will convert your PDF" dialog
    $doc = $word.Documents.Open(
        $InputPath,    # FileName
        $false,        # ConfirmConversions — suppress conversion dialog
        $false,        # ReadOnly — need write to save as DOCX
        $false,        # AddToRecentFiles
        [Type]::Missing, # PasswordDocument
        [Type]::Missing, # PasswordTemplate
        $false,        # Revert
        [Type]::Missing, # WritePasswordDocument
        [Type]::Missing, # WritePasswordTemplate
        [Type]::Missing, # Format
        [Type]::Missing, # Encoding
        $false,        # Visible
        $false,        # OpenConflictDocument
        $true          # OpenAndRepair
    )

    # Force repagination
    $doc.Repaginate()
    $pageCount = $doc.ComputeStatistics(2)  # wdStatisticPages

    # Count images (InlineShapes + Shapes)
    $imageCount = 0
    try {
        $imageCount += $doc.InlineShapes.Count
        $imageCount += $doc.Shapes.Count
    } catch {}

    # Detect watermarks (shapes in headers with specific properties)
    $hasWatermark = $false
    try {
        foreach ($section in $doc.Sections) {
            foreach ($header in $section.Headers) {
                if ($header.Shapes.Count -gt 0) {
                    foreach ($shape in $header.Shapes) {
                        # PowerPoint shapes used as watermarks typically:
                        # - Are behind text (WrapType)
                        # - Have rotation
                        # - Have semi-transparency
                        if ($shape.Type -eq 17 -or  # msoTextEffect (WordArt watermark)
                            $shape.Type -eq 1 -or   # msoAutoShape
                            $shape.Type -eq 15) {    # msoFreeform
                            $hasWatermark = $true
                            break
                        }
                    }
                }
                if ($hasWatermark) { break }
            }
            if ($hasWatermark) { break }
        }
    } catch {}

    # Detect headers and footers
    $hasHeaders = $false
    $hasFooters = $false
    try {
        foreach ($section in $doc.Sections) {
            foreach ($header in $section.Headers) {
                if ($header.Range.Text.Trim().Length -gt 1) {
                    $hasHeaders = $true
                    break
                }
            }
            foreach ($footer in $section.Footers) {
                if ($footer.Range.Text.Trim().Length -gt 1) {
                    $hasFooters = $true
                    break
                }
            }
            if ($hasHeaders -and $hasFooters) { break }
        }
    } catch {}

    # Count tables
    $tableCount = 0
    try {
        $tableCount = $doc.Tables.Count
    } catch {}

    # Save as DOCX (wdFormatXMLDocument = 16)
    # Use minimal params only — extra boolean params cause COM interop type-conversion errors
    $doc.SaveAs2($OutputPath, 16)

    # Close document (wdDoNotSaveChanges = 0)
    $doc.Close([ref]0)
    $doc = $null

    # Quit Word — use no-arg Quit to avoid PSReference COM interop error
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    $word = $null

    $elapsed = ((Get-Date) - $startTime).TotalMilliseconds

    # Validate output
    if (-not (Test-Path $OutputPath)) {
        throw "DOCX output file was not created"
    }
    $outSize = (Get-Item $OutputPath).Length
    if ($outSize -lt 500) {
        throw "DOCX output is suspiciously small ($outSize bytes)"
    }

    Write-JsonResult -Success $true -OutputPath $OutputPath -PageCount $pageCount `
        -ImageCount $imageCount -HasWatermark $hasWatermark `
        -HasHeaders $hasHeaders -HasFooters $hasFooters -TableCount $tableCount `
        -ErrorMsg "" -Elapsed $elapsed

} catch {
    $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
    $errorMsg = $_.Exception.Message

    # Friendly error messages
    if ($errorMsg -match "password|protected|encryption") {
        $errorMsg = "PDF is password-protected. Please unlock it first and try again."
    }
    elseif ($errorMsg -match "could not be found|not found") {
        $errorMsg = "File not found or inaccessible."
    }
    elseif ($errorMsg -match "RPC|server.*unavailable|DCOM") {
        $errorMsg = "Microsoft Word COM automation is not available. Ensure Word is installed."
    }
    elseif ($errorMsg -match "corrupt|damaged|invalid") {
        $errorMsg = "The PDF file appears to be corrupted or damaged."
    }

    Write-JsonResult -Success $false -OutputPath "" -PageCount 0 `
        -ImageCount 0 -HasWatermark $false `
        -HasHeaders $false -HasFooters $false -TableCount 0 `
        -ErrorMsg $errorMsg -Elapsed $elapsed

} finally {
    # Ensure cleanup
    if ($doc -ne $null) {
        try { $doc.Close([ref]0) } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {}
    }
    if ($word -ne $null) {
        try { $word.Quit() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
    }

    # Force garbage collection
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    # Kill any orphan WINWORD processes spawned after our start
    Get-Process -Name "WINWORD" -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -ge $startTime } |
        ForEach-Object {
            try { $_.Kill() } catch {}
        }
}
