# Generic Project Startup Guide (AWS Serverless + React)

Use this guide to start any new app from scratch. It assumes the developer already has their local environment configured. This document is app-agnostic: you will define your own features and data model.

---

## 1. How to Use This Document

1. Create a new empty folder for the project.
2. Copy this file into that folder.
3. Open the folder in VS Code.
4. Tell Copilot to read this file and help build the project.

---

## 2. Recommended Copilot Prompts (Generic)

### Prompt A - Project definition

"Read GENERIC_PROJECT_STARTUP_GUIDE.md and help me define the MVP: scope, entities, user flows, and key pages."

### Prompt B - Architecture plan

"Based on GENERIC_PROJECT_STARTUP_GUIDE.md, propose a scalable architecture and the minimal version to ship first. Include frontend, backend, and AWS resources."

### Prompt C - Scaffolding

"Using GENERIC_PROJECT_STARTUP_GUIDE.md, generate project scaffolding for React + TypeScript + Vite and a Node.js AWS Lambda backend with basic CRUD."

### Prompt D - Risk checklist

"Using GENERIC_PROJECT_STARTUP_GUIDE.md, list common risks (CORS, deployment, AWS permissions) and how to avoid them."

---

## 3. Baseline Architecture (Scalable, Iterative)

### Recommended Stack

- Frontend: React + TypeScript + Vite
- Backend: AWS Lambda (Node.js 20.x)
- API: API Gateway (REST or HTTP API)
- Database: DynamoDB
- Hosting: S3 + CloudFront

### Why this stack

- Serverless cost model
- Scales without manual infrastructure
- Fast iteration
- Low operational overhead

---

## 4. AWS Services You Will Likely Need

### Core Services

- **Lambda**: Backend logic and APIs
- **API Gateway**: HTTP routing, CORS, security
- **DynamoDB**: Primary datastore
- **S3**: Frontend hosting and file storage
- **CloudFront**: CDN + HTTPS
- **IAM**: Permissions and security
- **CloudWatch Logs**: Debugging and monitoring

### Optional Services

- **ACM**: SSL certificates for custom domains
- **Route 53**: DNS
- **Secrets Manager**: Store credentials
- **SQS**: Background jobs
- **EventBridge**: Event routing

---

## 4.1 User Login and Security (Recommended Approach)

If your app needs user accounts, use Amazon Cognito.

### Why Cognito

- Managed user pools (passwords, MFA, password reset)
- JWT tokens for API authentication
- Integrates cleanly with API Gateway and Lambda

### Minimal Setup (MVP)

1. Create a Cognito User Pool
2. Create an App Client (no client secret for SPA)
3. Configure callback URLs for your frontend
4. Use Hosted UI or custom login form with the Cognito SDK

### API Gateway Integration (JWT Authorizer)

- Create a JWT authorizer in API Gateway
- Attach to protected routes (POST/PUT/DELETE)
- Keep GET endpoints public only if needed

### Lambda Verification (Optional)

- JWT is verified by API Gateway; Lambda receives claims in event
- Use claims for userId, email, roles

### Basic Security Recommendations

- Enforce HTTPS only (CloudFront + ACM)
- Use least-privilege IAM for Lambda
- Store secrets in Secrets Manager
- Log authentication failures in CloudWatch

### When to Add Auth

- As soon as real user data is stored
- Before any external client access
- When you need auditability or per-user permissions

### Sample Cognito Setup Notes

Use these values in `.env.local` (frontend):

```
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=your-domain-prefix.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:5173/logout
```

### JWT Authorizer (API Gateway)

- Issuer: `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>`
- Audience: `<app-client-id>`
- Apply to protected routes only

### Minimal React Auth Example (Hosted UI)

```tsx
const loginUrl = `https://${import.meta.env.VITE_COGNITO_DOMAIN}/login?client_id=${import.meta.env.VITE_COGNITO_CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(import.meta.env.VITE_COGNITO_REDIRECT_URI)}`;

export const LoginButton = () => (
  <a
    href={loginUrl}
    className="inline-flex items-center rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
  >
    Sign In
  </a>
);
```

### Attach JWT to API Requests

```tsx
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 5. Standard Project Phases

### Phase 1: MVP

- Core entities and CRUD
- Single Lambda for simplicity
- Basic UI (lists + forms)

### Phase 2: UX polish

- Validation
- Loading states
- Error handling
- Responsive layout

### Phase 3: Scale

- Split Lambda into domains if needed
- Add caching or secondary indexes
- Add auth (Cognito)

### When to Add Advanced Features

Use this decision guide before adding complexity:

- **Lazy loading**: Add when bundle size grows or pages are rarely used (reports, exports)
- **Route loaders**: Add when you want data fetching tied to navigation with built-in error handling
- **Optimistic UI**: Add when the action is quick and rollback is easy (simple lists)
- **Error boundaries**: Add once the app has multiple pages and async loading
- **Cognito auth**: Add when the app requires user-level security or auditability
- **Multiple Lambdas**: Add when deployments are getting too slow or teams split by domain

### Advanced Features Decision Checklist (Quick)

Use this quick list before adding complexity:

- Is the feature used weekly or only occasionally?
- Is the current bundle size slowing page load?
- Do users need a faster, more responsive UI now?
- Is rollback easy if we add optimistic UI?
- Are we starting to need per-user security?
- Are deployments slowing the team?

If you answered "yes" to two or more, it is likely time to add the advanced feature.

## 6. Repository Setup

### Initial Setup

```bash
git init
npm create vite@latest web-frontend -- --template react-ts
cd web-frontend
npm install
```

### Suggested Structure

```
web-frontend/
  src/
    components/
    services/
    types/
lambda/
  index.js
  package.json
docs/
  DEVELOPMENT_STATUS.md
  DEPLOYMENT_CHECKLIST.md
```

### Commit Strategy

- Commit small, working steps
- Use clear messages (feat/fix/chore)

---

## 7. DynamoDB Table Design

### General Guidance

- Use hyphen naming: MyApp-Entity
- Use UUID for primary keys
- Add GSIs only when needed for common queries

### Example (Generic)

```
Table: MyApp-Items
PK: id (string)
GSI: OwnerIdIndex (ownerId)
```

---

## 8. API Gateway + Lambda Tips (Critical Learnings)

### 8.1 CORS Must Be Configured Twice

- Method response headers
- Integration response headers

If either is missing, the browser will block requests.

### 8.2 API Gateway Routes Must Match Lambda

- Lambda can have handlers, but if API Gateway has no route, it will never be called.
- Always verify resources and methods are created.

### 8.3 CORS Preflight Testing

Use OPTIONS requests to verify headers:

```bash
curl -i -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/prod/items
```

### 8.4 Lambda Permissions

Ensure API Gateway can invoke Lambda:

```bash
aws lambda add-permission \
  --function-name MyLambda \
  --statement-id apigateway-all-methods \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:<region>:<account>:<api-id>/*/*"
```

---

## 9. Lambda Deployment Tips (Critical Learnings)

### 9.1 Always include dependencies

If your Lambda uses node_modules, they must be included in the zip.

### 9.2 Safe packaging (Windows)

```powershell
cd lambda
npm install
Compress-Archive -Path index.js,package.json,package-lock.json,node_modules -DestinationPath lambda-deploy.zip -Force
```

### 9.3 Upload

- Prefer AWS Console for small teams
- Verify Last Modified timestamp in Lambda

---

## 10. Frontend Deployment (S3 + CloudFront)

```bash
npm run build
aws s3 sync dist/ s3://<bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

---

## 10.1 CI/CD Basics (GitHub Actions)

Keep CI/CD minimal at first:

- Build and test on every pull request
- Deploy only from main branch

Example `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run build
      - run: npm run test -- --runInBand
```

Example `.github/workflows/deploy.yml` (frontend only):

```yaml
name: deploy-frontend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws s3 sync dist/ s3://<bucket-name> --delete
      - run: aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

---

## 10.2 Unit Testing Basics

Use a lightweight stack:

- **Vitest** for unit tests
- **@testing-library/react** for UI tests

Minimal setup:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Example `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Example test:

```tsx
import { render, screen } from "@testing-library/react";
import { ItemList } from "./ItemList";

test("renders heading", () => {
  render(<ItemList />);
  expect(screen.getByText("Items")).toBeInTheDocument();
});
```

Add a test script:

```json
"scripts": {
  "test": "vitest"
}
```

---

## 10.3 API Versioning

Use versioned routes from day one:

- `/v1/items`
- `/v1/projects`

Benefits:

- Safe future changes
- Clear deprecation path

Tip:

- Keep v1 stable; add v2 only for breaking changes

---

## 10.4 Environment Configuration

Standardize environment variables early:

- `.env.local` for developer overrides
- `.env.production` for production builds

Example `.env.local`:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_ENV=local
```

Example `.env.production`:

```
VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
VITE_ENV=production
```

Guidelines:

- Never commit secrets to git
- Use CI/CD secrets for deployment
- Keep config keys consistent across environments

---

## 10.5 Backend Deployment Example (Lambda + API Gateway)

Minimal GitHub Actions workflow for Lambda deploy:

```yaml
name: deploy-backend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd lambda && npm install
      - run: cd lambda && zip -r ../lambda-deploy.zip .
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws lambda update-function-code --function-name <lambda-name> --zip-file fileb://lambda-deploy.zip
```

Notes:

- Package all dependencies inside the zip
- Avoid including `.env` or local secrets
- If API Gateway methods change, deploy API Gateway separately

---

## 11. Sample Lambda Handler (Generic CRUD)

```javascript
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  const { httpMethod, path } = event;

  if (httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (httpMethod === "GET" && path === "/items") {
    const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
    return { statusCode: 200, headers, body: JSON.stringify(data.Items || []) };
  }

  if (httpMethod === "POST" && path === "/items") {
    const body = JSON.parse(event.body || "{}");
    const item = { id: randomUUID(), ...body };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return { statusCode: 201, headers, body: JSON.stringify(item) };
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ message: "Not found" }),
  };
};
```

---

## 12. Sample Frontend Service (Generic)

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export const itemService = {
  async getAll() {
    const res = await api.get("/items");
    return res.data;
  },
  async create(data: Record<string, unknown>) {
    const res = await api.post("/items", data);
    return res.data;
  },
};
```

---

## 12.1 Sample Frontend UI (Generic CRUD Screen)

```tsx
import { useEffect, useState } from "react";
import { itemService } from "../services/itemService";

type Item = { id: string; name: string; description?: string };

export const ItemList = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    itemService
      .getAll()
      .then(setItems)
      .catch(() => setError("Failed to load items"));
  }, []);

  const handleCreate = async () => {
    setError(null);
    try {
      const created = await itemService.create({ name, description });
      setItems((prev) => [...prev, created]);
      setName("");
      setDescription("");
    } catch {
      setError("Failed to create item");
    }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold">Items</h1>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          className="border px-2 py-1 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border px-2 py-1 text-sm"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          className="bg-indigo-600 px-3 py-1 text-sm text-white"
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          Add
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded border px-3 py-2">
            <div className="text-sm font-medium">{item.name}</div>
            {item.description && (
              <div className="text-xs text-gray-500">{item.description}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## 12.2 Frontend Recommendations (Generic)

- Use a service layer per entity (itemService, userService, etc.)
- Keep API base URL in `.env.local` as `VITE_API_BASE_URL`
- Use small, focused components instead of giant pages
- Show errors near the action that failed
- Use controlled inputs for forms
- Keep tables compact for data-heavy screens

---

## 12.3 Sample Compact Table Page (No Dark Overlay)

```tsx
type Row = { id: string; name: string; status?: string };

export const CompactTable = ({ rows }: { rows: Row[] }) => (
  <div className="mt-4 bg-white shadow rounded-lg overflow-hidden">
    <table className="min-w-full text-xs">
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr>
          <th className="px-2 py-1 text-left font-medium text-gray-600">
            Name
          </th>
          <th className="px-2 py-1 text-left font-medium text-gray-600">
            Status
          </th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="hover:bg-gray-50 border-b border-gray-200"
          >
            <td className="px-2 py-1 text-gray-900">{row.name}</td>
            <td className="px-2 py-1 text-gray-900">{row.status || "-"}</td>
            <td className="px-2 py-1 text-right">
              <button className="text-indigo-600 hover:text-indigo-900">
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

---

## 12.4 Sample Modal Form (Light Overlay)

```tsx
type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
};

export const SimpleModal = ({ open, title, onClose, onSave }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 12.4.1 Modal With Validation (Inline Errors)

```tsx
import { useState } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
};

export const ValidatedModal = ({
  open,
  title,
  onClose,
  onSave,
}: ModalProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      onClose();
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-4 space-y-3">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 12.4.2 Modal With Field-Level Errors

```tsx
import { useState } from "react";

type Errors = { name?: string; description?: string };

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
};

export const FieldErrorModal = ({
  open,
  title,
  onClose,
  onSave,
}: ModalProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = "Name is required";
    if (description.length > 200)
      next.description = "Description must be 200 characters or less";
    return next;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      setErrors({});
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              className={`w-full px-2 py-1 text-xs border rounded-md ${
                errors.name ? "border-red-300" : "border-gray-300"
              }`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <div className="text-xs text-red-600 mt-1">{errors.name}</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className={`w-full px-2 py-1 text-xs border rounded-md ${
                errors.description ? "border-red-300" : "border-gray-300"
              }`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <div className="text-xs text-red-600 mt-1">
                {errors.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 12.4.3 Optional Schema Validation (Zod)

If you want centralized validation, use `zod` in your form layer.

```tsx
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z
    .string()
    .max(200, "Description must be 200 characters or less"),
});

const result = itemSchema.safeParse({ name, description });
if (!result.success) {
  const fieldErrors = result.error.flatten().fieldErrors;
  // fieldErrors.name and fieldErrors.description can map to inline errors
}
```

---

## 12.5 Error Banner and Action Bar Snippet

```tsx
export const ErrorBanner = ({ message }: { message: string }) => (
  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
    {message}
  </div>
);

export const ActionBar = ({ onAdd }: { onAdd: () => void }) => (
  <div className="mt-4 flex gap-2">
    <button
      onClick={onAdd}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
    >
      + Add Item
    </button>
  </div>
);
```

---

## 12.6 Save and Loading UX (Disable, Spinner, Feedback)

Use these patterns to avoid duplicate saves and user confusion.

```tsx
import { useState } from "react";

export const SaveButtonExample = ({
  onSave,
}: {
  onSave: () => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
    >
      {saving ? "Saving..." : "Save"}
    </button>
  );
};
```

Optional inline spinner:

```tsx
<button
  onClick={handleSave}
  disabled={saving}
  className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
>
  {saving && (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
  )}
  {saving ? "Saving..." : "Save"}
</button>
```

Guidelines:

- Disable the action while saving
- Change button label to show progress
- Use a spinner for longer actions
- Show error feedback near the button if save fails

---

## 12.7 Save + Close and Optimistic UI Patterns

Save + close pattern (common in modals):

```tsx
const handleSave = async () => {
  if (saving) return;
  setSaving(true);
  try {
    await onSave();
    onClose(); // Close only after successful save
  } catch {
    setError("Save failed. Please try again.");
  } finally {
    setSaving(false);
  }
};
```

Optimistic UI example (add item immediately, then rollback on failure):

```tsx
const handleCreate = async (draft: Item) => {
  const tempId = `temp-${Date.now()}`;
  const optimistic = { ...draft, id: tempId };
  setItems((prev) => [...prev, optimistic]);

  try {
    const created = await itemService.create(draft);
    setItems((prev) => prev.map((i) => (i.id === tempId ? created : i)));
  } catch {
    setItems((prev) => prev.filter((i) => i.id !== tempId));
    setError("Create failed. Please try again.");
  }
};
```

Guidelines:

- Close modals only on success
- Keep the button disabled while saving
- Use optimistic UI only when rollback is easy

---

## 12.8 Lazy Loading (When to Use It)

Use lazy loading to reduce bundle size for heavy pages or rare features.

Example with React lazy + Suspense:

```tsx
import { Suspense, lazy } from "react";

const ReportsPage = lazy(() => import("./pages/ReportsPage"));

export const AppRoutes = () => (
  <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
    <ReportsPage />
  </Suspense>
);
```

Lazy load heavy utilities on demand:

```tsx
const handleExport = async () => {
  const { exportToCsv } = await import("../utils/exportToCsv");
  exportToCsv(rows);
};
```

Guidelines:

- Lazy load rarely used pages (reports, exports, admin tools)
- Lazy load large libraries (charts, export tools)
- Keep core routes eager for smooth navigation

---

## 12.8.1 Lazy Loading With React Router

Example with route-level lazy loading:

```tsx
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

export const App = () => (
  <BrowserRouter>
    <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
```

Guidelines:

- Keep the fallback lightweight (simple text or spinner)
- Lazy load secondary routes first
- Avoid lazy loading very small components

---

## 12.8.2 Lazy Loading With Nested Layouts

Example using a shared layout with nested routes:

```tsx
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";

const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const AppLayout = () => (
  <div className="min-h-screen bg-gray-50">
    <header className="border-b bg-white px-4 py-2 text-sm font-semibold">
      My App
    </header>
    <main className="px-4 py-4">
      <Outlet />
    </main>
  </div>
);

export const App = () => (
  <BrowserRouter>
    <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
);
```

Guidelines:

- Keep layout components eager and lightweight
- Lazy load route screens, not shared layout
- Avoid nesting Suspense too deeply

---

## 12.8.3 Route Loaders and Error Boundaries

Example using React Router data loaders and error boundaries (v6.4+):

```tsx
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
} from "react-router-dom";

const ErrorBoundary = () => {
  const error = useRouteError() as Error;
  return (
    <div className="p-4 text-sm text-red-700">
      {error?.message || "Something went wrong"}
    </div>
  );
};

const projectsLoader = async () => {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/projects`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProjectsPage />,
    loader: projectsLoader,
    errorElement: <ErrorBoundary />,
  },
]);

export const App = () => <RouterProvider router={router} />;
```

Guidelines:

- Keep loaders small and focused
- Throw explicit errors for failed fetches
- Keep error UI compact and readable

---

## 12.8.4 Route Loader With Axios Service Wrapper

If your app uses a shared API wrapper, use it in the loader for consistency.

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import api from "./services/api";

const projectsLoader = async () => {
  const res = await api.get("/projects");
  return res.data;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProjectsPage />,
    loader: projectsLoader,
    errorElement: <ErrorBoundary />,
  },
]);

export const App = () => <RouterProvider router={router} />;
```

Guidelines:

- Reuse your API wrapper to keep auth headers and base URL consistent
- Keep loaders focused on data fetching only

---

## 13. Common Mistakes to Avoid

- Forgetting to update API Gateway after adding a Lambda route
- Missing CORS headers on OPTIONS responses
- Packaging Lambda without node_modules
- Using inconsistent DynamoDB table names
- Hardcoding AWS account IDs in scripts

---

## 14. Suggested Early Documentation

- DEVELOPMENT_STATUS.md
- DEPLOYMENT_CHECKLIST.md
- FIELD_ADDITION_CHECKLIST.md
- SESSION_SUMMARY_YYYY-MM-DD.md

---

## 15. Junior-Focused Step-by-Step (Generic)

This section is for new developers. It includes concrete steps and checkpoints.

### Step 1: Create the repo and scaffold frontend

```bash
git init
npm create vite@latest web-frontend -- --template react-ts
cd web-frontend
npm install
npm run dev
```

Checkpoint: You can open http://localhost:5173

Commit: "chore: frontend scaffold"

### Step 2: Create backend folder and Lambda skeleton

```bash
cd ..
mkdir lambda
```

Create `lambda/index.js` with a basic handler and CORS headers.

Commit: "chore: lambda skeleton"

### Step 3: Create DynamoDB table

- Create a table named `MyApp-Items`
- Partition key: `id` (string)

Checkpoint: Table is ACTIVE in AWS console.

### Step 4: Hook frontend to backend

- Create `src/services/itemService.ts`
- Build `ItemList.tsx` and test GET/POST

Checkpoint: You can create and list items.

Commit: "feat: items CRUD"

### Step 5: Deploy frontend

```bash
npm run build
aws s3 sync dist/ s3://<bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

Checkpoint: App loads in CloudFront URL.

Commit: "chore: first deploy"

---

## 16. Junior Training Plan (4 Weeks)

This is a training schedule to build skills while delivering real progress.

### Week 1: Fundamentals and First CRUD

Goals:

- Understand the repo, tooling, and deployment flow
- Ship a working CRUD flow for one entity

Tasks:

1. Follow Steps 1-5 in the Junior Step-by-Step section.
2. Add one extra field to the item (e.g., status) and update UI + Lambda.
3. Write a short session summary in docs/SESSION_SUMMARY_YYYY-MM-DD.md.

Checkpoint:

- GET/POST working end-to-end
- Deployment completed

### Week 2: Add One More Entity and Relationships

Goals:

- Add a second entity
- Introduce a simple relationship (e.g., items belong to a project)

Tasks:

1. Add a Projects table and CRUD.
2. Add a projectId field to items.
3. Add a query by projectId (GSI + API route).
4. Update UI to filter items by project.

Checkpoint:

- Create project, create item under project, list by project

### Week 3: UX and Error Handling

Goals:

- Improve UI quality
- Add validation and error feedback

Tasks:

1. Add loading indicators to pages and forms.
2. Add field validation on create/edit forms.
3. Add better error messages from API failures.
4. Add compact table layout for list views.

Checkpoint:

- UI shows loading and error states consistently

### Week 4: Deployment and Ops

Goals:

- Build confidence in AWS deployment and troubleshooting

Tasks:

1. Deploy frontend again after changes.
2. Package and deploy Lambda with dependencies.
3. Use CloudWatch logs to debug one forced error.
4. Verify CORS preflight works with OPTIONS.

Checkpoint:

- Developer can deploy and debug without assistance

---
