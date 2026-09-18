# Renders every slide of the deck to PNG using Microsoft PowerPoint (COM),
# for visual QA. Usage:  powershell -File render-ppt.ps1
$deck = "D:\Claude\Skatting - Copy\docs\presentation\PRSA_Client_Presentation.pptx"
$out  = "D:\Claude\Skatting - Copy\docs\presentation\qa-render"
if (Test-Path $out) { Remove-Item "$out\*" -Force }
New-Item -ItemType Directory -Force $out | Out-Null

$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open($deck, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
  $i = 0
  foreach ($slide in $pres.Slides) {
    $i++
    $file = Join-Path $out ("slide-{0:D2}.png" -f $i)
    $slide.Export($file, "PNG", 1600, 900)
  }
  $pres.Close()
  Write-Output ("rendered {0} slides to {1}" -f $i, $out)
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
