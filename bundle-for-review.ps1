$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$bundleDir = Join-Path $root "review-bundle"
$srcDir = Join-Path $root "src"
$maxBytes = 25 * 1024 * 1024

# 1. Clean review-bundle/
if (Test-Path $bundleDir) {
    Remove-Item $bundleDir -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleDir | Out-Null
Write-Host "Cleaned review-bundle/"

# 2. Zip src/ into src.zip
$srcZip = Join-Path $bundleDir "src.zip"
Compress-Archive -Path $srcDir -DestinationPath $srcZip -CompressionLevel Optimal
Write-Host "Created src.zip"

# 3. If src.zip > 25MB, split by subdirectory
if ((Get-Item $srcZip).Length -gt $maxBytes) {
    Write-Host "src.zip exceeds 25MB — splitting by subdirectory..."
    Remove-Item $srcZip -Force

    # Collect root-level files and subdirectories inside src/
    $rootFiles = Get-ChildItem -Path $srcDir -File
    $subDirs = Get-ChildItem -Path $srcDir -Directory

    $partNum = 1
    $currentItems = @()
    $currentSize = 0

    # Helper: flush current items into a zip
    function Flush-Part {
        if ($currentItems.Count -eq 0) { return }
        $partZip = Join-Path $bundleDir "src-$partNum.zip"
        # Create a temp directory mirroring src/ structure
        $tempDir = Join-Path $env:TEMP "cyto-bundle-$partNum"
        $tempSrc = Join-Path $tempDir "src"
        if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
        New-Item -ItemType Directory -Path $tempSrc | Out-Null
        foreach ($item in $currentItems) {
            if ($item.PSIsContainer) {
                Copy-Item $item.FullName -Destination (Join-Path $tempSrc $item.Name) -Recurse
            } else {
                Copy-Item $item.FullName -Destination (Join-Path $tempSrc $item.Name)
            }
        }
        Compress-Archive -Path $tempSrc -DestinationPath $partZip -CompressionLevel Optimal
        Remove-Item $tempDir -Recurse -Force
        Write-Host "  Created src-$partNum.zip"
        $script:partNum++
        $script:currentItems = @()
        $script:currentSize = 0
    }

    # Add root files first
    foreach ($f in $rootFiles) {
        $currentItems += $f
        $currentSize += $f.Length
    }

    # Add subdirectories, flushing when we'd exceed the limit
    foreach ($d in $subDirs) {
        $dirSize = (Get-ChildItem -Path $d.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
        if ($dirSize -eq $null) { $dirSize = 0 }

        if ($currentSize + $dirSize -gt $maxBytes -and $currentItems.Count -gt 0) {
            Flush-Part
        }
        $currentItems += $d
        $currentSize += $dirSize
    }
    Flush-Part
} else {
    Write-Host "src.zip is under 25MB — no splitting needed"
}

# 4. Zip root config files
$configFiles = @("CLAUDE.md", "package.json", "tsconfig.json", "index.html", "vite.config.ts", "tailwind.config.ts")
$configPaths = @()
foreach ($f in $configFiles) {
    $p = Join-Path $root $f
    if (Test-Path $p) { $configPaths += $p }
}
if ($configPaths.Count -gt 0) {
    $configZip = Join-Path $bundleDir "config.zip"
    Compress-Archive -Path $configPaths -DestinationPath $configZip -CompressionLevel Optimal
    Write-Host "Created config.zip"
}

# 5. Print file sizes
Write-Host ""
Write-Host "=== review-bundle contents ==="
Get-ChildItem $bundleDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    $sizeKB = [math]::Round($_.Length / 1KB, 1)
    if ($sizeMB -ge 1) {
        Write-Host ("  {0,-25} {1,8} MB" -f $_.Name, $sizeMB)
    } else {
        Write-Host ("  {0,-25} {1,8} KB" -f $_.Name, $sizeKB)
    }
}
Write-Host "Done."
