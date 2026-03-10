# View Personal Knowledge
# Displays your personal developer knowledge in formatted output

$knowledgePath = "C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json"

if (-not (Test-Path $knowledgePath)) {
    Write-Error "Knowledge file not found: $knowledgePath"
    exit 1
}

$knowledge = Get-Content $knowledgePath -Raw | ConvertFrom-Json

Write-Host "`n=== PERSONAL KNOWLEDGE ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROFILE" -ForegroundColor Green
Write-Host "  Experience: $($knowledge.profile.experience)"
Write-Host "  Expertise:"
$knowledge.profile.expertise | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Preferred Languages:"
$knowledge.profile.preferredLanguages | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Preferred Frameworks:"
$knowledge.profile.preferredFrameworks | ForEach-Object { Write-Host "    - $_" }
Write-Host ""

Write-Host "CODING PREFERENCES" -ForegroundColor Green
Write-Host "  Style:"
$knowledge.codingPreferences.style | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Patterns:"
$knowledge.codingPreferences.patterns | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Anti-Patterns:"
$knowledge.codingPreferences.antiPatterns | ForEach-Object { Write-Host "    - $_" }
Write-Host "  Best Practices:"
$knowledge.codingPreferences.bestPractices | ForEach-Object { Write-Host "    - $_" }
Write-Host ""

Write-Host "COMMON SOLUTIONS ($($knowledge.commonSolutions.Count))" -ForegroundColor Green
$knowledge.commonSolutions | Sort-Object -Property frequency -Descending | ForEach-Object {
    Write-Host "  [$($_.frequency)x] $($_.problem)" -ForegroundColor Yellow
    Write-Host "    Solution: $($_.solution)"
    Write-Host "    Tags: $($_.tags -join ', ')"
    Write-Host ""
}

Write-Host "CODE SNIPPETS ($($knowledge.snippets.Count))" -ForegroundColor Green
$knowledge.snippets | ForEach-Object {
    Write-Host "  [$($_.language)] $($_.name)" -ForegroundColor Yellow
    Write-Host "    $($_.description)"
    Write-Host ""
}

Write-Host "TOOLS & COMMANDS ($($knowledge.toolsAndCommands.Count))" -ForegroundColor Green
$knowledge.toolsAndCommands | ForEach-Object {
    Write-Host "  $($_.name)" -ForegroundColor Yellow
    Write-Host "    Command: $($_.command)"
    Write-Host "    Purpose: $($_.purpose)"
    if ($_.platform) {
        Write-Host "    Platform: $($_.platform)"
    }
    Write-Host ""
}

Write-Host "LEARNING NOTES ($($knowledge.learningNotes.Count))" -ForegroundColor Green
$knowledge.learningNotes | ForEach-Object {
    Write-Host "  [$($_.date)] $($_.topic)" -ForegroundColor Yellow
    Write-Host "    $($_.note)"
    Write-Host "    Tags: $($_.tags -join ', ')"
    Write-Host ""
}
