<#
.SYNOPSIS
Generates 3 test fixtures from a base Lore Olympus page, each with a
different seeded contradiction (eyes / hair / outfit). For use with
mnemo watch or as standalone test fixtures for demo recordings.

.DESCRIPTION
Mnemo's continuity checker is intentionally strict - it only flags
high-confidence contradictions, so real Lore Olympus pages (drawn consistent
with canon) correctly return 0 flags. For a video segment you need pages
WITH contradictions. This script takes a real page and produces 3 variants
that the checker will each flag once:

  page_eyes.png    - eye color replaced with bright green
  page_hair.png    - hair color replaced with blonde
  page_outfit.png  - outfit replaced with blue

You MUST adjust the 3 region coordinates near the top of the script to
match your specific base image. Open the base image in any editor
(Paint.net, Photoshop, GIMP), hover over the eyes / hair / outfit
area, and note the (X, Y, Width, Height) of the bounding box.

.PARAMETER BaseImage
Path to the source page (e.g. data\series\lore-olympus\pages\ep003_p01.jpg).

.PARAMETER OutputDir
Directory to write the 3 fixtures to. Defaults to test-images\.

.EXAMPLE
powershell -File scripts\seed-3-fixtures.ps1 `
    -BaseImage data\series\lore-olympus\pages\ep003_p01.jpg

After verifying the 3 PNGs look right, copy them into the series pages
folder and run the watch CLI:

  cp test-images\page_eyes.png   data\series\lore-olympus\pages\ep003_p11.png
  cp test-images\page_hair.png   data\series\lore-olympus\pages\ep003_p12.png
  cp test-images\page_outfit.png data\series\lore-olympus\pages\ep003_p13.png

  npm run mnemo -- watch --series lore-olympus --pages p11,p12,p13
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseImage,

    [string]$OutputDir = "test-images"
)

Add-Type -AssemblyName System.Drawing

# ---------------------------------------------------------------------------
# Configuration - adjust the 3 regions to match your specific base image.
#
# How to find coordinates:
#   1. Open the base image in any image editor (Paint.net, Photoshop, GIMP).
#   2. Find the bounding box of the eyes (smallest rect containing both).
#   3. Find the bounding box of the hair.
#   4. Find the bounding box of the outfit / torso.
#   5. Plug X, Y, Width, Height into the config below.
# ---------------------------------------------------------------------------

$script:EyesRegion   = @{ X = 200; Y =  80; Width = 150; Height =  60 }   # <- adjust
$script:HairRegion   = @{ X = 180; Y =  30; Width = 200; Height = 120 }   # <- adjust
$script:OutfitRegion = @{ X = 220; Y = 200; Width = 200; Height = 250 }   # <- adjust

# Seed colors - deliberately unnatural so the checker flags them.
$script:EyesColor    = [System.Drawing.Color]::FromArgb(255,  50, 220,  80)  # green
$script:HairColor    = [System.Drawing.Color]::FromArgb(255, 255, 220, 100)  # blonde
$script:OutfitColor  = [System.Drawing.Color]::FromArgb(255,  50,  80, 220)  # blue

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function New-SeededFixture {
    param(
        $Source,
        $Dest,
        $Region,
        $Color
    )

    if (-not (Test-Path $Source)) {
        throw "Source image not found: $Source"
    }

    $sourcePath = (Resolve-Path $Source).Path
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap $img

    $x = [int]$Region.X
    $y = [int]$Region.Y
    $w = [int]$Region.Width
    $h = [int]$Region.Height

    # Clamp to image bounds (avoid SetPixel out-of-range exceptions)
    $w = [Math]::Min($w, $bmp.Width  - $x)
    $h = [Math]::Min($h, $bmp.Height - $y)

    Write-Host ("    painting {0}x{1} region at ({2},{3}) with #{4:X2}{5:X2}{6:X2}" -f `
        $w, $h, $x, $y, $Color.R, $Color.G, $Color.B)

    for ($py = $y; $py -lt ($y + $h); $py++) {
        for ($px = $x; $px -lt ($x + $w); $px++) {
            $bmp.SetPixel($px, $py, $Color)
        }
    }

    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    $destPath = Join-Path $OutputDir $Dest
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $img.Dispose()

    Write-Host "  [ok] $destPath"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "Generating 3 seeded fixtures from: $BaseImage"
Write-Host "Output dir:                       $OutputDir"
Write-Host ""

New-SeededFixture -Source $BaseImage -Dest "page_eyes.png"   -Region $script:EyesRegion   -Color $script:EyesColor
New-SeededFixture -Source $BaseImage -Dest "page_hair.png"   -Region $script:HairRegion   -Color $script:HairColor
New-SeededFixture -Source $BaseImage -Dest "page_outfit.png" -Region $script:OutfitRegion -Color $script:OutfitColor

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. Open each PNG and verify the seed region actually hits the right area"
Write-Host "     (if a region is wrong, edit the coordinates near the top of this script and re-run)"
Write-Host "  2. Copy into the series pages folder so the watch CLI can pick them up:"
Write-Host "       cp test-images\page_eyes.png   data\series\lore-olympus\pages\ep003_p11.png"
Write-Host "       cp test-images\page_hair.png   data\series\lore-olympus\pages\ep003_p12.png"
Write-Host "       cp test-images\page_outfit.png data\series\lore-olympus\pages\ep003_p13.png"
Write-Host "  3. Run the watch CLI on those 3 pages:"
Write-Host "       npm run mnemo -- watch --series lore-olympus --pages p11,p12,p13"
Write-Host "  Expected: 3 flags, one per page (eye_color / hair_color / outfit)."
Write-Host ""
