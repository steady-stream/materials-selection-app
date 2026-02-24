# Migration Script: Add isSelected field and sync LineItemOptions with LineItems
# This script ensures all line items with products have corresponding LineItemOptions with isSelected=true

$apiUrl = "https://xrld1hq3e2.execute-api.us-east-1.amazonaws.com/prod"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "LineItemOptions Migration Script - Hybrid Approach" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get all projects
Write-Host "Fetching all projects..." -ForegroundColor Yellow
$projectsResponse = Invoke-RestMethod -Uri "$apiUrl/projects" -Method Get
# API returns { "projects": [...] } not a direct array
$projects = $projectsResponse.projects

Write-Host "Found $($projects.Count) projects" -ForegroundColor Green
Write-Host ""

$totalLineItems = 0
$lineItemsWithProducts = 0
$optionsCreated = 0
$optionsUpdated = 0
$errors = 0

# Step 2: Process each project
foreach ($project in $projects) {
    Write-Host "Processing project: $($project.name)" -ForegroundColor Cyan
    
    # Get all line items for this project
    $lineItemsResponse = Invoke-RestMethod -Uri "$apiUrl/projects/$($project.id)/lineitems" -Method Get
    $lineItems = $lineItemsResponse
    
    $totalLineItems += $lineItems.Count
    
    foreach ($lineItem in $lineItems) {
        # Only process line items that have a product selected
        if ($lineItem.productId) {
            $lineItemsWithProducts++
            
            Write-Host "  Line Item: $($lineItem.name) (Product: $($lineItem.productId))" -ForegroundColor White
            
            try {
                # Get existing options for this line item
                $existingOptions = Invoke-RestMethod -Uri "$apiUrl/lineitems/$($lineItem.id)/options" -Method Get
                
                # Check if an option already exists for this product
                $matchingOption = $existingOptions | Where-Object { $_.productId -eq $lineItem.productId }
                
                if ($matchingOption) {
                    # Update existing option to be selected
                    if (-not $matchingOption.isSelected) {
                        Write-Host "    Updating existing option to isSelected=true" -ForegroundColor Yellow
                        
                        $updateBody = @{
                            isSelected = $true
                        } | ConvertTo-Json
                        
                        Invoke-RestMethod -Uri "$apiUrl/lineitem-options/$($matchingOption.id)" -Method Put -Body $updateBody -ContentType "application/json"
                        $optionsUpdated++
                        Write-Host "    ✓ Updated" -ForegroundColor Green
                    }
                    else {
                        Write-Host "    Already marked as selected" -ForegroundColor Gray
                    }
                }
                else {
                    # Create new option as selected
                    Write-Host "    Creating new option with isSelected=true" -ForegroundColor Yellow
                    
                    $createBody = @{
                        productId  = $lineItem.productId
                        unitCost   = $lineItem.unitCost
                        isSelected = $true
                    } | ConvertTo-Json
                    
                    Invoke-RestMethod -Uri "$apiUrl/lineitems/$($lineItem.id)/options" -Method Post -Body $createBody -ContentType "application/json"
                    $optionsCreated++
                    Write-Host "    ✓ Created" -ForegroundColor Green
                }
                
                # Deselect all other options for this line item
                $otherOptions = $existingOptions | Where-Object { $_.productId -ne $lineItem.productId -and $_.isSelected }
                
                foreach ($otherOption in $otherOptions) {
                    Write-Host "    Deselecting option: $($otherOption.productId)" -ForegroundColor Gray
                    
                    $deselectBody = @{
                        isSelected = $false
                    } | ConvertTo-Json
                    
                    Invoke-RestMethod -Uri "$apiUrl/lineitem-options/$($otherOption.id)" -Method Put -Body $deselectBody -ContentType "application/json"
                }
                
            }
            catch {
                Write-Host "    ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
                $errors++
            }
        }
    }
    
    Write-Host ""
}

# Summary
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Migration Summary" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Total Projects: $($projects.Count)"
Write-Host "Total Line Items: $totalLineItems"
Write-Host "Line Items with Products: $lineItemsWithProducts"
Write-Host "Options Created: $optionsCreated" -ForegroundColor Green
Write-Host "Options Updated: $optionsUpdated" -ForegroundColor Yellow
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($errors -eq 0) {
    Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
}
else {
    Write-Host "⚠ Migration completed with errors. Please review the log above." -ForegroundColor Yellow
}
