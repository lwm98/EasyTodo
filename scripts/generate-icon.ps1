Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDirectory = Join-Path $projectRoot 'assets'
$outputPath = Join-Path $assetDirectory 'icon.png'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null

$size = 256
$bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.RectangleF(16, 16, 224, 224)
$radius = 56
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$diameter = $radius * 2
$path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
$path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
$path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()

$startColor = [System.Drawing.Color]::FromArgb(255, 121, 111, 235)
$endColor = [System.Drawing.Color]::FromArgb(255, 75, 65, 181)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $startColor, $endColor, 45)
$graphics.FillPath($brush, $path)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 22)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$points = [System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF(72, 132)),
  (New-Object System.Drawing.PointF(111, 169)),
  (New-Object System.Drawing.PointF(187, 86))
)
$graphics.DrawLines($pen, $points)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose()
$brush.Dispose()
$path.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $outputPath"
