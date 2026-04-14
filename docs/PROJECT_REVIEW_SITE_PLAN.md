# Project Review Site — Feature Plan

## Summary

A shareable, read-only web page that lets an end client review their project's product
selections without logging into the app. Sent as a link + PIN via email.
Mirrors what the PowerPoint export shows today, formatted as a clean web page.

**Status**: Planned — not yet built  
**Decisions locked**:

- Live data (always reflects current project state)
- 30-day expiry + user can manually revoke at any time
- Content matches current PPT output — no additional scope for v1

---

## User Flow

```
MegaPros user opens project detail
  → clicks "Share with Client"
  → app generates a share token + 4-digit PIN
  → displays a dialog: "Link copied! PIN: 7492"
  → user emails client: "Here's your review link: https://projects.megapros.com/review/a3f8c2d1  PIN: 7492"

End client opens link
  → sees PIN entry screen (no login, no account needed)
  → enters PIN
  → sees read-only project review page
  → link works for 30 days from the share date

MegaPros user can revoke any time
  → project detail shows "Shared — expires May 14 · [Revoke]"
  → clicking Revoke immediately invalidates the link
```

---

## Architecture

### New DynamoDB Table: `ProjectShares`

| Attribute        | Type        | Notes                                          |
| ---------------- | ----------- | ---------------------------------------------- |
| `shareToken`     | String (PK) | UUID, becomes the URL slug                     |
| `projectId`      | String      | FK to Projects table                           |
| `orgId`          | String      | Extracted from JWT — never from request body   |
| `pin`            | String      | 4-digit, stored as bcrypt hash (cost factor 8) |
| `failedAttempts` | Number      | Incremented on wrong PIN                       |
| `lockedUntil`    | String      | ISO timestamp — set after 5 failed attempts    |
| `expiresAt`      | String      | ISO timestamp — `createdAt + 30 days`          |
| `createdAt`      | String      | ISO timestamp                                  |
| `updatedAt`      | String      | ISO timestamp                                  |

GSI: `ProjectIdIndex` on `projectId` — for looking up whether a project already has an active share.

> **Note on PIN storage**: Store as a bcrypt hash, not plaintext. The PIN is only shown to
> the MegaPros user once at share creation time — it cannot be retrieved again (only revoked
> and regenerated). Cost factor 8 is fast enough for a 4-digit PIN without adding perceivable
> latency.

### New Lambda Routes (in `projects` lambda)

| Method   | Path                   | Auth        | Purpose                                       |
| -------- | ---------------------- | ----------- | --------------------------------------------- |
| `POST`   | `/projects/{id}/share` | Cognito JWT | Generate share token + PIN for a project      |
| `DELETE` | `/projects/{id}/share` | Cognito JWT | Revoke (delete) the active share              |
| `GET`    | `/projects/{id}/share` | Cognito JWT | Get active share status (expiry, not the PIN) |
| `GET`    | `/review/{token}`      | None        | Validate PIN, return project data if valid    |

#### `POST /projects/{id}/share` — Create Share

- `orgId` from JWT claim (never from body)
- Check if active (non-expired) share already exists for this project — if so, return it
  (idempotent; user clicking "Share" twice doesn't generate two tokens)
- Generate `shareToken` = UUID v4
- Generate `pin` = 4 random digits (crypto.randomInt)
- Hash PIN with bcrypt
- Write to `ProjectShares` table with `expiresAt = now + 30 days`
- Return `{ shareToken, pin, expiresAt }` — pin is only returned this one time

#### `DELETE /projects/{id}/share` — Revoke

- Verify `orgId` from JWT matches the share record
- Delete the share record from DynamoDB
- Returns 204

#### `GET /review/{token}` — Public Endpoint (no auth)

- Look up `shareToken` in `ProjectShares`
- If not found → `404` (generic message, don't reveal token doesn't exist)
- If expired → `410 Gone`
- If `lockedUntil` is in the future → `429` with seconds remaining
- Accept `pin` query param: `GET /review/{token}?pin=7492`
- If PIN missing → `401` (prompt client to enter PIN — don't confirm token is valid)
- Compare PIN to stored hash (bcrypt.compare)
- If wrong:
  - Increment `failedAttempts`
  - If `failedAttempts >= 5`: set `lockedUntil = now + 1 hour`, reset counter
  - Return `401`
- If correct:
  - Fetch project + categories + line items + products + manufacturers + vendors
  - Same data set as `fetchProjectData()` in `pptxService.ts`
  - Return full review payload
  - Do NOT log successful PIN to CloudWatch

---

## Frontend

### New Route: `/review/:token`

- **Located in**: `src/components/ReviewPage.tsx` (new file)
- **Router**: added to `src/main.tsx` alongside existing routes
- **No Cognito auth wrapper** — this route is intentionally public
- Two render states: `<PinEntry>` and `<ReviewContent>`

### PIN Entry Screen

- Centered card, MegaPros logo
- "Enter the 4-digit PIN provided with your review link"
- 4-character input (numeric only, auto-submit on 4th digit)
- Wrong PIN: "Incorrect PIN. Please try again." (after 3 wrong: "3 attempts remaining")
- Locked: "Too many incorrect attempts. Please try again after [time]."
- Expired link: "This review link has expired. Please contact your MegaPros representative."

### Review Page Content

Mirrors the PPT structure, rendered as sections:

**Page header** (matches PPT cover slide)

- MegaPros logo
- Project name, customer name, address
- Project number (if set)
- Review date (share creation date)
- "Prepared by: Judy Hogel | judy@megapros.com | 847-652-4185"

**Per-category section** (matches PPT section divider slide)

- Category name as section heading
- Total category budget

**Per-line-item card** (matches PPT product slide)

- Line item name (large, bold)
- Status badge with color (Selected / Final / Option 1 / No Selection — same colors as PPT)
- Product name, description, model number
- Manufacturer name
- Vendor name (if set)
- Quantity + unit
- Unit cost | Total cost
- Allowance (if set)
- Product image (right side — same S3 or external URL)
- Product URL as a clickable link (if set)

**Option cards** (matches PPT option slides)

- Same card layout with "Option 1", "Option 2" badge
- Shown below the selected product within the same line item section

**Page footer**

- "This review is provided for your reference. Prices and selections subject to change."
- MegaPros contact info

### "Share with Client" UI in Project Detail

- New button in project detail header: `[ Share with Client ]`
- If no active share: clicking generates one, shows dialog with link + PIN
- If active share exists: shows "Shared — expires [date]" + `[ Copy Link ]` + `[ Revoke ]`
- Revoke prompts "Are you sure? The client's link will stop working immediately."

---

## API Gateway

One new route in the **prod AND test** API Gateway:

| Method | Path              | Auth | Lambda                            |
| ------ | ----------------- | ---- | --------------------------------- |
| `GET`  | `/review/{token}` | NONE | `MaterialsSelection-Projects-API` |

The `/projects/{id}/share` routes are under the existing `/projects/{id}` resource which
already has Cognito JWT authorization — no API GW changes needed there, just add the
Lambda route handlers.

---

## Security Checklist

- [ ] `orgId` always from JWT, never from body — even on share creation
- [ ] PIN stored as bcrypt hash — never logged, never returned after creation
- [ ] Rate limiting: 5 wrong PINs → 1-hour lockout (tracked in DynamoDB)
- [ ] Token is a UUID — not guessable, not sequential
- [ ] Expiry enforced in Lambda, not just frontend
- [ ] Generic error messages on the public endpoint — don't reveal whether a token exists
- [ ] No CloudWatch logging of correct PINs or full share payloads
- [ ] `GET /review/{token}` returns only the data the PPT shows — no internal IDs, no orgId

---

## Implementation Sequence

Do these in order — each step is independently deployable and testable.

### Phase 1 — DynamoDB + Lambda (backend only)

1. Create `ProjectShares-{env}` DynamoDB table with `ProjectIdIndex` GSI
2. Add `POST /projects/{id}/share` route — generates token + PIN, returns both
3. Add `DELETE /projects/{id}/share` route — revokes
4. Add `GET /projects/{id}/share` route — returns status (no PIN)
5. Add `GET /review/{token}` route — PIN validation + data fetch
6. Deploy to **test**, smoke test all 4 endpoints with Invoke-WebRequest
7. Deploy to **prod**

### Phase 2 — Frontend PIN Entry + Basic Review Page

1. Add `/review/:token` route to React Router in `main.tsx`
2. Build PIN entry screen component
3. Build basic review page — just text, no images, minimal styling
4. Test end-to-end in test environment: generate share, visit link, enter PIN, see data

### Phase 3 — Review Page Styling

1. Style the header (logo, project info)
2. Style category sections with headings and budget totals
3. Style product cards (image right, details left — mirrors PPT layout)
4. Style option cards with badge
5. Add status badge colors matching PPT
6. Mobile-responsive layout
7. Test on phone

### Phase 4 — App UI Integration

1. Add "Share with Client" button to `ProjectDetail.tsx`
2. Add share status indicator (active share → shows expiry + Revoke)
3. Add copy-link functionality
4. Add revoke confirmation dialog

### Phase 5 — Test & Deploy

1. Full end-to-end test in test environment
2. Verify rate limiting works (5 wrong PINs → lockout message)
3. Verify expiry works (manually set `expiresAt` to past in DynamoDB)
4. Verify revoke works
5. Deploy to prod
6. Test on prod with a real project

---

## Key Files to Create / Modify

| File                               | Action | Notes                                        |
| ---------------------------------- | ------ | -------------------------------------------- |
| `lambda/projects/index.js`         | Modify | Add 4 new route handlers                     |
| `src/components/ReviewPage.tsx`    | Create | PIN entry + review layout                    |
| `src/main.tsx`                     | Modify | Add `/review/:token` route (no auth wrapper) |
| `src/components/ProjectDetail.tsx` | Modify | Add share button + status                    |
| `src/types/index.ts`               | Modify | Add `ProjectShare` interface                 |

---

## Environment-Specific Notes

- Table names: `ProjectShares-test`, `ProjectShares-prod` (follow existing naming pattern)
- API GW `review` resource needed on both `xrld1hq3e2` (test) and `6extgb87v1` (prod)

### Review URL by Environment

| Environment      | Base URL                                 | Example Review Link                                      |
| ---------------- | ---------------------------------------- | -------------------------------------------------------- |
| Test             | `https://mpmaterials.apiaconsulting.com` | `https://mpmaterials.apiaconsulting.com/review/a3f8c2d1` |
| Prod (current)   | `https://d377ynyh0ngsji.cloudfront.net`  | `https://d377ynyh0ngsji.cloudfront.net/review/a3f8c2d1`  |
| Prod (after DNS) | `https://projects.megapros.com`          | `https://projects.megapros.com/review/a3f8c2d1`          |

The Lambda that generates the share token constructs the full URL using a `REVIEW_BASE_URL`
environment variable — never hardcoded. Set this on each Lambda at deploy time:

```powershell
# Test (already has custom domain)
REVIEW_BASE_URL = "https://mpmaterials.apiaconsulting.com"

# Prod — use CloudFront URL until projects.megapros.com DNS is live, then update to:
REVIEW_BASE_URL = "https://projects.megapros.com"
```

When the custom domain goes live on prod, update this one env var and new share links will
use the branded URL. Links already sent to clients using the CloudFront URL continue to work
indefinitely — the CloudFront domain never goes away.

---

## Open Questions (decide before Phase 1)

1. **PIN display after creation**: Show once in a dialog (current plan), or also email it
   automatically? Auto-email requires an email service to be wired up.
2. **Multiple active shares per project?** Current plan: one active share per project
   (re-sharing regenerates). Alternative: allow multiple (useful if sharing with multiple
   contacts). Simplest for v1: one at a time.
3. **"Final" items only vs. all items?** Current PPT shows everything. The review page
   could optionally filter to only `status = "final"` items. Leave as "everything" for v1
   to match PPT behavior exactly.
