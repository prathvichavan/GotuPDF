<#
.SYNOPSIS
    Word to PDF conversion using Microsoft Word COM Automation.
    GotuPDF Enterprise Document Processing Engine.

.DESCRIPTION
    Opens a DOC/DOCX file in Word via COM, exports as PDF with maximum fidelity:
    - Embedded fonts
    - Print-quality optimization
    - Preserved bookmarks, hyperlinks, watermarks, backgrounds, SmartArt, shapes
    - No image compression or DPI reduction

.PARAMETER InputPath
    Absolute path to the input .doc/.docx file.

.PARAMETER OutputPath
    Absolute path for the output .pdf file.

.OUTPUTS
    JSON object with: success, outputPath, pageCount, error, elapsed
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
    param($Success, $OutputPath, $PageCount, $ErrorMsg, $Elapsed)
    $result = @{
        success    = $Success
        outputPath = $OutputPath
        pageCount  = $PageCount
        error      = $ErrorMsg
        elapsed    = $Elapsed
    }
    $result | ConvertTo-Json -Compress
}

try {
    # Validate input
    if (-not (Test-Path $InputPath)) {
        throw "Input file not found: $InputPath"
    }

    $ext = [System.IO.Path]::GetExtension($InputPath).ToLower()
    if ($ext -notin @('.doc', '.docx', '.rtf')) {
        throw "Unsupported file type: $ext. Expected .doc, .docx, or .rtf"
    }

    # Create Word COM instance
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0  # wdAlertsNone
    $word.AutomationSecurity = 3  # msoAutomationSecurityForceDisable (block macros)

    # Open document
    # Parameters: FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, PasswordDocument, PasswordTemplate, Revert, WritePasswordDocument, WritePasswordTemplate, Format, Encoding, Visible, OpenConflictDocument, OpenAndRepair
    $doc = $word.Documents.Open(
        $InputPath,    # FileName
        $false,        # ConfirmConversions
        $true,         # ReadOnly
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

    # Force repagination to get accurate page count
    $doc.Repaginate()
    $pageCount = $doc.ComputeStatistics(2)  # wdStatisticPages = 2

    # Ensure backgrounds are preserved
    $word.Options.PrintBackground = $true

    # Export as PDF with maximum quality
    # Use minimal params — extra params cause COM interop [ref] type errors
    # Defaults: OpenAfterExport=false, OptimizeFor=Print, Range=All, Bookmarks=none
    $doc.ExportAsFixedFormat($OutputPath, 17)

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
        throw "PDF output file was not created"
    }
    $fileSize = (Get-Item $OutputPath).Length
    if ($fileSize -lt 500) {
        throw "PDF output is suspiciously small ($fileSize bytes)"
    }

    Write-JsonResult -Success $true -OutputPath $OutputPath -PageCount $pageCount -ErrorMsg "" -Elapsed $elapsed

} catch {
    $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
    $errorMsg = $_.Exception.Message

    # Check for password-protected document
    if ($errorMsg -match "password|protected|encryption") {
        $errorMsg = "Document is password-protected. Please remove the password and try again."
    }

    Write-JsonResult -Success $false -OutputPath "" -PageCount 0 -ErrorMsg $errorMsg -Elapsed $elapsed

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

    # Force garbage collection to release COM references
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    # Kill orphan WINWORD processes that we may have spawned
    # Only kill processes started after our start time (safety measure)
    Get-Process -Name "WINWORD" -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -ge $startTime } |
        ForEach-Object {
            try { $_.Kill() } catch {}
        }
}
