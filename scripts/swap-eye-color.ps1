Add-Type -AssemblyName System.Drawing

$path = "C:\Users\Emma0\OneDrive\Documents\GitHub\mnemo\test-images\page_contradiction.png"
$backup = "C:\Users\Emma0\OneDrive\Documents\GitHub\mnemo\test-images\page_contradiction.original.png"

# ponytail: backup once, then overwrite in place. Test harness reads page_contradiction.png by name.
if (-not (Test-Path $backup)) {
  Copy-Item -LiteralPath $path -Destination $backup -Force
}

$bmp = [System.Drawing.Bitmap]::FromFile($path)
$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$bmpData = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $bmp.PixelFormat)

$bytesPerPixel = [System.Drawing.Image]::GetPixelFormatSize($bmp.PixelFormat) / 8
$height = $bmp.Height
$totalBytes = $bmpData.Stride * $height
$bytes = New-Object byte[] $totalBytes
[System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $bytes, 0, $totalBytes)

# ponytail: vivid green = G channel dominant by a wide margin. Catches the eyes
# (saturated green) without touching neon-sign text (mostly white/cyan).
$swapCount = 0
for ($i = 0; $i -lt $bytes.Length; $i += $bytesPerPixel) {
  $b = $bytes[$i]
  $g = $bytes[$i + 1]
  $r = $bytes[$i + 2]
  if ($g -gt 180 -and $g -gt ($r + 80) -and $g -gt ($b + 30)) {
    $bytes[$i] = 20       # B
    $bytes[$i + 1] = 20   # G
    $bytes[$i + 2] = 240  # R
    $swapCount++
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $bmpData.Scan0, $totalBytes)
$bmp.UnlockBits($bmpData)

# ponytail: GDI+ refuses to overwrite the source PNG, so save to MemoryStream
# then write the bytes. Same end result, dodges the GDI+ "generic error".
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
[System.IO.File]::WriteAllBytes($path, $ms.ToArray())
$ms.Dispose()

Write-Host "Swapped $swapCount pixels from vivid-green to red."
Write-Host "Original backed up to: $backup"
