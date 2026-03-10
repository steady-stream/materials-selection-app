# Used as GIT_SEQUENCE_EDITOR to mark 2653b5f for editing
param($file)
$content = Get-Content $file -Raw
$content = $content -replace "^pick 2653b5f", "edit 2653b5f"
Set-Content $file $content
