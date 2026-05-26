# Materials Selection App - Quick Restart Checklist

Date: 2026-05-25
Project: MaterialsSelectionApp/WebPrototype

## 1. Reconnect Access

1. Restore network/share access to \\LS220D986\Apia.
2. Reconnect mapped drive G:.
3. Confirm project path exists:
   - Test-Path G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype
4. Change directory to:
   - G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype

## 2. Deploy Remaining Backend Work

1. Run:
   - ./deploy-lambda-test.ps1
2. Confirm deploy success in account:
   - 634752426026

## 3. Frontend Status

1. Frontend deploy already completed in prior session.
2. Test URL:
   - https://mpmaterials.apiaconsulting.com
3. CloudFront invalidation already created:
   - I8LZ1WUBBXQEZWU6OBVYA5UECR
4. Re-deploy frontend only if needed:
   - ./deploy-test.ps1

## 4. Validation Smoke Test

1. ProductList modal:
   - Errors display inside modal (not behind modal).
   - Variation validation errors show inline per row.
2. Base model semantics:
   - Product base model remains authoritative.
   - Variation effective models stay on variation rows.
3. ProductList table:
   - Variation count badge appears for multi-variation products.
   - Expand/collapse reveals variation details.
4. ProjectDetail Insert Product modal:
   - Variation badge and expandable variation details appear.

## 5. If Lambda Deploy Fails Again

1. Run from valid local path first:
   - Set-Location C:\
2. Verify mapping and connectivity:
   - net use
   - Test-Path G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype
3. Retry deploy after path is stable.

## 6. Resume Prompt

Resume from 2026-05-25 handoff. Frontend is already deployed to test. Continue by running deploy-lambda-test.ps1 after restoring G: path, then validate ProductList modal errors, inline variation validation, base model behavior, and variation expansion in ProductList and ProjectDetail Insert Product modal.

## 7. Related Full Handoff

Full detail document:
C:\CopilotStore\MaterialsSelectionApp-Session-Handoff-2026-05-25.md
