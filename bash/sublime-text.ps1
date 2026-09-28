# ==============================================================================
# Script Patch Sublime Text 4 (Build 4213 & 4215) - Windows x64
# ==============================================================================

# Admin elevation
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs; exit;
}

# Set vars
$path = "C:\Program Files\Sublime Text\sublime_text.exe";
if (-not (Test-Path $path)) { Write-Host " [!] File not found: $path" -ForegroundColor Red; pause; exit; }

[byte[]]$old = @(0x0F, 0xB6, 0x51, 0x0C, 0x83, 0xF2, 0x01);
[byte[]]$new = @(0xC6, 0x41, 0x0C, 0x01, 0x31, 0xD2, 0x90);

# Read file and search for pattern
[byte[]]$bytes = [System.IO.File]::ReadAllBytes($path);$index = -1;
$searchPos = 0;

while ($searchPos -ge 0 -and$searchPos -le ($bytes.Length -$old.Length)) {
    $foundPos = [System.Array]::IndexOf($bytes, $old[0],$searchPos);
    if ($foundPos -eq -1 -or$foundPos -gt ($bytes.Length -$old.Length)) { break; }
    
    $match =$true;
    for ($j = 1; $j -lt $old.Length; $j++) {
        if ($bytes[$foundPos +$j] -ne $old[$j]) { $match =$false; break; }
    }
    
    if ($match) { $index =$foundPos; break; }
    $searchPos =$foundPos + 1;
}

# Stop process, backup and patch if bytes match
if ($index -ge 0) {
    Get-Process "sublime_text" -ErrorAction SilentlyContinue | Stop-Process -Force;
    Copy-Item $path "$path.bak" -Force;
    
    [System.Array]::Copy($new, 0,$bytes, $index,$new.Length);
    [System.IO.File]::WriteAllBytes($path,$bytes);
    
    Write-Host " [+] Patch applied successfully at 0x$($index.ToString('X'))! Backup created." -ForegroundColor Green;
} else {
    Write-Host " [!] Byte pattern not found. No backup created." -ForegroundColor Yellow;
}

pause;
