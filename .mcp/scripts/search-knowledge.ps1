# Search Knowledge
# Search through project or personal knowledge
# Usage: .\search-knowledge.ps1 -Query "CORS" -Scope Project
# Usage: .\search-knowledge.ps1 -Query "Lambda" -Scope Personal

param(
    [Parameter(Mandatory = $true)]
    [string]$Query,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Project", "Personal", "Both")]
    [string]$Scope = "Both"
)

function Search-ProjectKnowledge {
    param([string]$searchTerm)
    
    $knowledgePath = "$PSScriptRoot\..\project-knowledge\knowledge.json"
    if (-not (Test-Path $knowledgePath)) {
        Write-Warning "Project knowledge file not found"
        return
    }
    
    $knowledge = Get-Content $knowledgePath -Raw | ConvertFrom-Json
    $results = @()
    
    # Search architecture decisions
    $knowledge.architectureDecisions | ForEach-Object {
        if ($_.decision -match $searchTerm -or $_.reasoning -match $searchTerm -or $_.tags -contains $searchTerm) {
            $results += "[Architecture Decision] $($_.date): $($_.decision)"
        }
    }
    
    # Search API endpoints
    $knowledge.apiEndpoints | ForEach-Object {
        if ($_.name -match $searchTerm -or $_.url -match $searchTerm -or $_.purpose -match $searchTerm) {
            $results += "[API] $($_.method) $($_.url) - $($_.purpose)"
        }
    }
    
    # Search common issues
    $knowledge.commonIssues | ForEach-Object {
        if ($_.issue -match $searchTerm -or $_.solution -match $searchTerm) {
            $results += "[Issue] $($_.issue): $($_.solution)"
        }
    }
    
    # Search development notes
    $knowledge.developmentNotes | ForEach-Object {
        if ($_.note -match $searchTerm -or $_.category -match $searchTerm) {
            $results += "[Note - $($_.category)] $($_.date): $($_.note)"
        }
    }
    
    if ($results.Count -gt 0) {
        Write-Host "`nPROJECT KNOWLEDGE - Found $($results.Count) matches:" -ForegroundColor Cyan
        $results | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
    }
}

function Search-PersonalKnowledge {
    param([string]$searchTerm)
    
    $knowledgePath = "C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json"
    if (-not (Test-Path $knowledgePath)) {
        Write-Warning "Personal knowledge file not found"
        return
    }
    
    $knowledge = Get-Content $knowledgePath -Raw | ConvertFrom-Json
    $results = @()
    
    # Search common solutions
    $knowledge.commonSolutions | ForEach-Object {
        if ($_.problem -match $searchTerm -or $_.solution -match $searchTerm -or $_.tags -contains $searchTerm) {
            $results += "[Solution - $($_.frequency)x] $($_.problem): $($_.solution)"
        }
    }
    
    # Search snippets
    $knowledge.snippets | ForEach-Object {
        if ($_.name -match $searchTerm -or $_.description -match $searchTerm -or $_.tags -contains $searchTerm) {
            $results += "[Snippet - $($_.language)] $($_.name): $($_.description)"
        }
    }
    
    # Search tools
    $knowledge.toolsAndCommands | ForEach-Object {
        if ($_.name -match $searchTerm -or $_.command -match $searchTerm -or $_.purpose -match $searchTerm) {
            $results += "[Tool] $($_.name): $($_.purpose)"
        }
    }
    
    # Search learning notes
    $knowledge.learningNotes | ForEach-Object {
        if ($_.topic -match $searchTerm -or $_.note -match $searchTerm -or $_.tags -contains $searchTerm) {
            $results += "[Note - $($_.date)] $($_.topic): $($_.note)"
        }
    }
    
    if ($results.Count -gt 0) {
        Write-Host "`nPERSONAL KNOWLEDGE - Found $($results.Count) matches:" -ForegroundColor Green
        $results | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
    }
}

# Execute search
if ($Scope -eq "Project" -or $Scope -eq "Both") {
    Search-ProjectKnowledge -searchTerm $Query
}

if ($Scope -eq "Personal" -or $Scope -eq "Both") {
    Search-PersonalKnowledge -searchTerm $Query
}
