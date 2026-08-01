Add-Type -AssemblyName System.Drawing

# Create 1024x500 image with white background
$width = 1024
$height = 500
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Fill with white background
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillRectangle($whiteBrush, 0, 0, $width, $height)

# Load and draw logo on left side
$logoPath = "d:\apl_appen\web_dashboard\public\logo.png"
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    # Scale logo to fit nicely (smaller size)
    $logoMaxWidth = 280
    $logoMaxHeight = 320
    $logoScale = [Math]::Min($logoMaxWidth / $logo.Width, $logoMaxHeight / $logo.Height)
    $logoWidth = [int]($logo.Width * $logoScale)
    $logoHeight = [int]($logo.Height * $logoScale)
    
    # Position logo more to the left
    $logoX = 50
    $logoY = ($height - $logoHeight) / 2
    
    $graphics.DrawImage($logo, $logoX, $logoY, $logoWidth, $logoHeight)
    $logo.Dispose()
}

# Add text on right side with same orange color as logo (E67621)
$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$orangeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 230, 118, 33))

# Main text (smaller font and closer to logo)
$mainText = "Tidkort - Bed$([char]0x00F6)mning - Uppf$([char]0x00F6)ljning"
$mainFont = New-Object System.Drawing.Font($fontFamily, 32, [System.Drawing.FontStyle]::Bold)
$mainTextSize = $graphics.MeasureString($mainText, $mainFont)
$mainTextX = 420
$mainTextY = ($height - $mainTextSize.Height) / 2
$graphics.DrawString($mainText, $mainFont, $orangeBrush, $mainTextX, $mainTextY)

# Save the image
$outputPath = "d:\apl_appen\google-play-feature-graphic-1024x500.png"
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$whiteBrush.Dispose()
$orangeBrush.Dispose()
$mainFont.Dispose()

Write-Host "Feature graphic with logo created successfully!" -ForegroundColor Green
Write-Host "Location: $outputPath" -ForegroundColor Cyan
