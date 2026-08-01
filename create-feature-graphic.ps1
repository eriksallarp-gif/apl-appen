Add-Type -AssemblyName System.Drawing

# Create 1024x500 image
$width = 1024
$height = 500
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Create gradient background (orange to darker orange)
$gradientBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($width, $height)),
    [System.Drawing.Color]::FromArgb(255, 230, 120, 30),
    [System.Drawing.Color]::FromArgb(255, 200, 80, 10)
)
$graphics.FillRectangle($gradientBrush, 0, 0, $width, $height)

# Add text "APL-appen"
$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$font = New-Object System.Drawing.Font($fontFamily, 80, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$text = "APL-appen"
$textSize = $graphics.MeasureString($text, $font)
$textX = ($width - $textSize.Width) / 2
$textY = 150
$graphics.DrawString($text, $font, $textBrush, $textX, $textY)

# Add subtitle
$subtitleFont = New-Object System.Drawing.Font($fontFamily, 26, [System.Drawing.FontStyle]::Regular)
# Use Unicode for Swedish characters
$subtitle = "Tidkort | Bed$([char]0x00F6)mning | Uppf$([char]0x00F6)ljning"
$subtitleSize = $graphics.MeasureString($subtitle, $subtitleFont)
$subtitleX = ($width - $subtitleSize.Width) / 2
$subtitleY = 290
$graphics.DrawString($subtitle, $subtitleFont, $textBrush, $subtitleX, $subtitleY)

# Save the image
$outputPath = "d:\apl_appen\google-play-feature-graphic-1024x500.png"
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$gradientBrush.Dispose()
$textBrush.Dispose()
$font.Dispose()
$subtitleFont.Dispose()

Write-Host "Feature graphic created successfully!" -ForegroundColor Green
Write-Host "Location: $outputPath" -ForegroundColor Cyan
