$source = "C:\Users\karlm\OneDrive\Documents\GitHub\chronicle-weaver"
$dest = "C:\Users\karlm\AppData\Local\FoundryVTT\Data\modules\chronicle-weaver"

Write-Host "Deploying Chronicle Weaver to $dest..."

if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest
}

Copy-Item -Path "$source\module.json" -Destination $dest -Force
Copy-Item -Path "$source\scripts" -Destination $dest -Recurse -Force
Copy-Item -Path "$source\styles" -Destination $dest -Recurse -Force
Copy-Item -Path "$source\templates" -Destination $dest -Recurse -Force
Copy-Item -Path "$source\lang" -Destination $dest -Recurse -Force

Write-Host "Deployment complete!"
