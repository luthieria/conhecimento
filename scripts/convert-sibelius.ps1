<#
.SYNOPSIS
  Convert Sibelius MusicXML exports to LilyPond (.ly) files,
  then optionally render them to SVG for static embedding.

.DESCRIPTION
  This script automates the Sibelius → MusicXML → LilyPond pipeline.
  
  Workflow:
  1. Export your score from Sibelius as MusicXML (.musicxml or .xml)
  2. Place the files in the input directory (default: content/music/musicxml/)
  3. Run this script — it will:
     a. Convert each .musicxml/.xml to .ly using musicxml2ly
     b. Optionally render each .ly to SVG using lilypond
  
  The output .ly files go to content/music/lilypond/
  The output .svg files go to static/music/svg/

.PARAMETER InputDir
  Directory containing MusicXML files from Sibelius export.
  
.PARAMETER OutputLyDir
  Directory for generated LilyPond files.

.PARAMETER OutputSvgDir
  Directory for generated SVG files (for static embedding).

.PARAMETER RenderSvg
  If set, also renders .ly files to SVG using LilyPond.

.PARAMETER NoBeaming
  Pass --no-beaming to musicxml2ly (use LilyPond auto-beaming).

.PARAMETER NoPageLayout
  Pass --no-page-layout to musicxml2ly (let LilyPond handle layout).

.EXAMPLE
  .\scripts\convert-sibelius.ps1
  
.EXAMPLE
  .\scripts\convert-sibelius.ps1 -RenderSvg -NoBeaming
  
.EXAMPLE
  .\scripts\convert-sibelius.ps1 -InputDir "C:\path\to\musicxml" -RenderSvg
#>

param(
  [string]$InputDir = "",
  [string]$OutputLyDir = "",
  [string]$OutputSvgDir = "",
  [switch]$RenderSvg,
  [switch]$NoBeaming,
  [switch]$NoPageLayout
)

# ── Paths ──────────────────────────────────────────────────────────
$LilyPondBin = "D:\Coding\Tools\lilypond\lilypond-2.26.0\bin"
$LilyPondExe = Join-Path $LilyPondBin "lilypond.exe"
$MusicXml2Ly = Join-Path $LilyPondBin "musicxml2ly.py"
$PythonExe   = Join-Path $LilyPondBin "python.exe"

$AmethystContent = "D:\Coding\Repositories\amethyst\content"
$AmethystStatic  = "D:\Coding\Repositories\amethyst\static"

if (-not $InputDir)    { $InputDir    = Join-Path $AmethystContent "music\musicxml" }
if (-not $OutputLyDir) { $OutputLyDir = Join-Path $AmethystContent "music\lilypond" }
if (-not $OutputSvgDir){ $OutputSvgDir = Join-Path $AmethystStatic "music\svg" }

# ── Ensure directories ────────────────────────────────────────────
@($InputDir, $OutputLyDir) | ForEach-Object {
  if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}
if ($RenderSvg -and -not (Test-Path $OutputSvgDir)) {
  New-Item -ItemType Directory -Path $OutputSvgDir -Force | Out-Null
}

# ── Validate tools ────────────────────────────────────────────────
if (-not (Test-Path $LilyPondExe)) {
  Write-Error "LilyPond not found at $LilyPondExe"
  exit 1
}

# ── Find MusicXML files ──────────────────────────────────────────
$xmlFiles = Get-ChildItem -Path $InputDir -Include "*.musicxml","*.xml","*.mxl" -Recurse -File
if ($xmlFiles.Count -eq 0) {
  Write-Host ""
  Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Yellow
  Write-Host "║  No MusicXML files found in input directory.      ║" -ForegroundColor Yellow
  Write-Host "║                                                    ║" -ForegroundColor Yellow
  Write-Host "║  To use this script:                               ║" -ForegroundColor Yellow
  Write-Host "║  1. Open your score in Sibelius                    ║" -ForegroundColor Yellow
  Write-Host "║  2. File → Export → MusicXML                       ║" -ForegroundColor Yellow
  Write-Host "║  3. Save the .musicxml file to:                    ║" -ForegroundColor Yellow
  Write-Host "║     $InputDir" -ForegroundColor Cyan
  Write-Host "║  4. Run this script again                          ║" -ForegroundColor Yellow
  Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Input directory: $InputDir" -ForegroundColor DarkGray
  exit 0
}

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host "│ Sibelius → LilyPond Converter" -ForegroundColor Cyan
Write-Host "│ Found $($xmlFiles.Count) MusicXML file(s)" -ForegroundColor DarkCyan
Write-Host "└──────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($xmlFile in $xmlFiles) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($xmlFile.Name)
  $lyOutput = Join-Path $OutputLyDir "$baseName.ly"
  
  Write-Host "  ♪ Converting: $($xmlFile.Name)" -ForegroundColor White -NoNewline
  
  # Build musicxml2ly arguments
  $args = @()
  $args += $MusicXml2Ly
  $args += "--output=$lyOutput"
  if ($NoBeaming)    { $args += "--no-beaming" }
  if ($NoPageLayout) { $args += "--no-page-layout" }
  $args += $xmlFile.FullName
  
  try {
    $result = & $PythonExe @args 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host " → $baseName.ly" -ForegroundColor Green
      $successCount++
      
      # Optionally render to SVG
      if ($RenderSvg) {
        Write-Host "    ↳ Rendering SVG..." -ForegroundColor DarkGray -NoNewline
        $svgArgs = @(
          "--svg",
          "--output=$OutputSvgDir\$baseName",
          $lyOutput
        )
        $svgResult = & $LilyPondExe @svgArgs 2>&1
        if ($LASTEXITCODE -eq 0) {
          Write-Host " ✓" -ForegroundColor Green
        } else {
          Write-Host " ✗ (SVG render failed)" -ForegroundColor Yellow
          Write-Host "      $svgResult" -ForegroundColor DarkGray
        }
      }
    } else {
      Write-Host " ✗ FAILED" -ForegroundColor Red
      Write-Host "    $result" -ForegroundColor DarkGray
      $failCount++
    }
  } catch {
    Write-Host " ✗ ERROR" -ForegroundColor Red
    Write-Host "    $_" -ForegroundColor DarkGray
    $failCount++
  }
}

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host "│ Results: $successCount converted, $failCount failed" -ForegroundColor Cyan
Write-Host "│ LilyPond files: $OutputLyDir" -ForegroundColor DarkCyan
if ($RenderSvg) {
  Write-Host "│ SVG files: $OutputSvgDir" -ForegroundColor DarkCyan
}
Write-Host "└──────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host ""
