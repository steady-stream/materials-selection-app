# View Project Knowledge
# Displays the Materials Selection App project knowledge in formatted output

$knowledgePath = "$PSScriptRoot\..\project-knowledge\knowledge.json"

if (-not (Test-Path $knowledgePath)) {
    Write-Error "Knowledge file not found: $knowledgePath"
    exit 1
}

$knowledge = Get-Content $knowledgePath -Raw | ConvertFrom-Json

Write-Host "`n=== PROJECT KNOWLEDGE: Materials Selection App ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROJECT INFO" -ForegroundColor Green
Write-Host "  Name: $($knowledge.projectInfo.name)"
Write-Host "  Description: $($knowledge.projectInfo.description)"
Write-Host "  Tech Stack:"
$knowledge.projectInfo.techStack | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Architecture:"
$knowledge.projectInfo.architecture | ForEach-Object { Write-Host "    - $_" }
Write-Host ""

Write-Host "ARCHITECTURE DECISIONS ($($knowledge.architectureDecisions.Count))" -ForegroundColor Green
$knowledge.architectureDecisions | ForEach-Object {
    Write-Host "  [$($_.date)] $($_.decision)" -ForegroundColor Yellow
    Write-Host "    Reasoning: $($_.reasoning)"
    Write-Host "    Tags: $($_.tags -join ', ')"
    Write-Host ""
}

Write-Host "API ENDPOINTS ($($knowledge.apiEndpoints.Count))" -ForegroundColor Green
$knowledge.apiEndpoints | ForEach-Object {
    Write-Host "  $($_.method) - $($_.name)" -ForegroundColor Yellow
    Write-Host "    URL: $($_.url)"
    Write-Host "    Purpose: $($_.purpose)"
    Write-Host ""
}

Write-Host "COMMON ISSUES ($($knowledge.commonIssues.Count))" -ForegroundColor Green
$knowledge.commonIssues | ForEach-Object {
    Write-Host "  Issue: $($_.issue)" -ForegroundColor Yellow
    Write-Host "    Solution: $($_.solution)"
    Write-Host "    Last Encountered: $($_.lastEncountered)"
    Write-Host ""
}

Write-Host "DEVELOPMENT NOTES ($($knowledge.developmentNotes.Count))" -ForegroundColor Green
$knowledge.developmentNotes | ForEach-Object {
    Write-Host "  [$($_.date)] [$($_.category)] $($_.note)"
}
Write-Host ""
