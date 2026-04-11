# 登录测试脚本
$body = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json -Depth 20

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -Headers $headers -SessionVariable "cookies"
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Headers: $($response.Headers | ConvertTo-Json)"
    
    $cookies = $response.Headers.Get('Set-Cookie')
    Write-Host "Cookies: $cookies"
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response: $($content | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $_"
}
