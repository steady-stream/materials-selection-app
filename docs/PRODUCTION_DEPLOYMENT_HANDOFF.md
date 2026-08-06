# Production deployment handoff

## Status summary
- The UI and API changes for the product-selection workflow, modal UX refinements, and PowerPoint export improvements are implemented locally and verified with a successful frontend build.
- The production deployment script is now wired to validate against the intended production AWS account ID (`860601623272`) rather than the test account.
- The remaining blocker is AWS account access: the production profile is currently returning `InvalidClientTokenId`, which indicates the account credentials or session are not valid for that production account.
- The owner of the production account has been contacted to verify whether the account is suspended or otherwise blocked from token issuance.

## What changed
- Updated [deploy-prod.ps1](../deploy-prod.ps1) to validate against the production account explicitly and to support passing an alternate profile/account for deployment runs.
- Added and updated Lambda batch endpoints for catalog/core data hydration and image proxy support in [lambda/catalog/index.js](../lambda/catalog/index.js) and [lambda/core/index.js](../lambda/core/index.js).
- Added batch data-loading support in [src/services/batchService.ts](../src/services/batchService.ts) and wired it from [src/services/index.ts](../src/services/index.ts).
- Improved the product picker and modal experience in [src/components/ChooseOptionsModal.tsx](../src/components/ChooseOptionsModal.tsx), [src/components/ProductList.tsx](../src/components/ProductList.tsx), and [src/components/ProjectDetail.tsx](../src/components/ProjectDetail.tsx).
- Added shared product option values in [src/constants/productOptionLists.ts](../src/constants/productOptionLists.ts) and used them for consistent color/finish filtering.
- Updated PowerPoint export logic in [src/services/pptxService.ts](../src/services/pptxService.ts) to be more robust against malformed values and to improve cover-slide rendering.
- Added production API Gateway CORS and batch-endpoint helper scripts under [add-cors-method-responses.ps1](../add-cors-method-responses.ps1), [add-prod-all-cors-headers.ps1](../add-prod-all-cors-headers.ps1), [fix-cors-method-responses.ps1](../fix-cors-method-responses.ps1), [fix-integration-responses.ps1](../fix-integration-responses.ps1), and [aws](../aws) for follow-up deployment once AWS access is restored.

## Verification completed
- Frontend production build verified successfully with `npm run build`.
- The deployment script now reaches the AWS authentication step and fails only because the production AWS credentials are not currently accepted.

## Next step once the account issue is resolved
1. Re-run the deployment script with the corrected production credentials.
2. If the API Gateway CORS work is still needed, run the production CORS helper scripts against the restored account.
3. Retest the affected flows in the production environment.
