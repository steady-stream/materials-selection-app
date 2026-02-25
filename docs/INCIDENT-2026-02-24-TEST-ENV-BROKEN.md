# Incident: Test Site "Application Error" After Section Modal Deploy — 2026-02-24

## What Happened

A small change was made to the section modal and deployed to the **test** site
(`https://mpmaterials.apiaconsulting.com`). After that, the test site showed the
Cognito login screen but crashed immediately after login with:

```
Cannot read properties of undefined (reading 'filter')
```

Production (`https://app.megapros.com` or equivalent) was unaffected throughout.

---

## Root Cause

`.env.local` contained an incorrect (non-existent) API Gateway ID:

```
# WRONG — this API ID does not exist in either AWS account
VITE_API_BASE_URL=https://fiad7hd58j.execute-api.us-east-1.amazonaws.com
```

Because the URL had no stage suffix (`/prod`) AND the API ID itself was invalid,
every API call after login failed. The response was not the expected
`{ projects: [...] }` shape, so when the `ProjectList` component called
`.filter()` on the result it received `undefined` and crashed.

---

## Why `.env.local` Matters More Than You'd Expect

Vite loads env files in this priority order (higher = wins):

| File               | Loaded when                        | Priority                           |
| ------------------ | ---------------------------------- | ---------------------------------- |
| `.env.local`       | **Every** build and mode           | **Highest — overrides everything** |
| `.env.production`  | `npm run build` (mode=production)  | Medium                             |
| `.env.development` | `npm run build --mode development` | Medium                             |
| `.env`             | Always                             | Lowest                             |

`.env.local` is **not** just for local development. It is baked into every build
run on the current machine, including production builds. If it contains test
values and `deploy-prod.ps1` is run, the prod bundle ends up with test API URLs
and test Cognito IDs — silently.

---

## Correct Resource Reference

| Environment | AWS Account  | API Gateway ID | Stage   | Cognito Pool          |
| ----------- | ------------ | -------------- | ------- | --------------------- |
| **Test**    | 634752426026 | `xrld1hq3e2`   | `/prod` | `us-east-1_K72aPw18O` |
| **Prod**    | 860601623272 | `6extgb87v1`   | `/prod` | `us-east-1_r52mUYVd5` |

Verify a stage is live: `aws apigateway get-stages --rest-api-id <id> --profile <profile>`

---

## Fix Applied

1. Corrected `.env.local` to the right test API URL (with `/prod` stage):
   ```
   VITE_API_BASE_URL=https://xrld1hq3e2.execute-api.us-east-1.amazonaws.com/prod
   VITE_SF_API_URL=https://xrld1hq3e2.execute-api.us-east-1.amazonaws.com/prod
   ```
2. Ran `deploy-test.ps1` — build:test mode picks up `.env.local`, ignores `.env.production`.
3. CloudFront invalidation completed; test site confirmed working.

---

## Safeguards Added

### `.env.local`

Added a prominent warning comment documenting the Vite override priority and
listing all known API IDs and Cognito pool IDs for quick reference.

### `deploy-prod.ps1`

Added a runtime guard: if `.env.local` exists on the machine the script pauses,
warns the operator, and requires typing `YES` to continue. This prevents silently
baking test values into a production bundle.

---

## How to Diagnose This Class of Error in the Future

1. Open browser DevTools → Network tab → look at the response for `/projects`
2. If it's an error body, HTML, or missing the `{ projects: [] }` structure,
   the API URL is wrong.
3. Check `.env.local` first — it wins over everything else.
4. Verify the API ID is real: `aws apigateway get-stages --rest-api-id <id> --profile <profile>`
5. Confirm the stage suffix (`/prod`) is included in `VITE_API_BASE_URL`.
