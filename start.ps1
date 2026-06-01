$node = "C:\Program Files\nodejs\node.exe"
$root = Split-Path $MyInvocation.MyCommand.Path

Write-Host "Starting backend on http://localhost:5001 ..." -ForegroundColor Cyan
Start-Process $node -ArgumentList "src/index.js" -WorkingDirectory "$root\backend" -WindowStyle Minimized

Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process $node -ArgumentList "node_modules\vite\bin\vite.js" -WorkingDirectory "$root\frontend" -WindowStyle Minimized

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "App running:" -ForegroundColor Green
Write-Host "  Frontend  -> http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend   -> http://localhost:5001" -ForegroundColor Green
Write-Host ""
Write-Host "Login:"
Write-Host "  School code : BFA001"
Write-Host "  Email       : kofi@bfa.edu.gh"
Write-Host "  Password    : Password1"

Start-Process "http://localhost:5173"
