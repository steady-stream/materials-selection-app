# Knowledge Management Setup Guide

Simple JSON-based knowledge persistence for cross-session AI assistance.

## What Was Created

Two knowledge bases using plain JSON files (no dependencies, no npm installs needed):

### 1. Project Knowledge

**Location**: `.mcp\project-knowledge\knowledge.json`

**Purpose**: Materials Selection App specific knowledge:

- Project architecture and tech stack
- API endpoints
- Architecture decisions
- Common issues specific to this project
- Development notes

**Travels with**: This git repository (automatically backed up)

### 2. Personal Knowledge

**Location**: `C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json`

**Purpose**: Your personal knowledge across ALL projects:

- Developer profile and preferences (35+ years experience)
- Coding style and patterns
- Reusable code snippets
- Common solutions to recurring problems
- Tools and commands you use frequently

**Travels with**: You (stays on your machine, sync via Dropbox/OneDrive if desired)

---

## Quick Start - Using the Knowledge

### Option 1: View Knowledge (PowerShell Scripts)

```powershell
# View all project knowledge
.\.mcp\scripts\view-project-knowledge.ps1

# View all personal knowledge
.\.mcp\scripts\view-personal-knowledge.ps1

# Search for specific topics
.\.mcp\scripts\search-knowledge.ps1 -Query "CORS" -Scope Project
.\.mcp\scripts\search-knowledge.ps1 -Query "Lambda" -Scope Both
```

### Option 2: Direct File Access

Open the JSON files in VS Code:

- [.mcp/project-knowledge/knowledge.json](.mcp/project-knowledge/knowledge.json)
- `C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json`

Edit them directly to add/update knowledge.

### Option 3: Use with Copilot

**At session start**, paste this into Copilot:

```
Read my personal knowledge from C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json
and project knowledge from .mcp/project-knowledge/knowledge.json to understand my preferences and this project's context.
```

**During the session**:

- "What architecture decisions have we made?"
- "What are my coding preferences?"
- "Search project knowledge for CORS"
- "Update project knowledge with this new API endpoint..."

**At session end**:

- "Update the knowledge files with what we learned today"
- "Add this architecture decision to project knowledge"

---

## Knowledge Structure

### Project Knowledge Schema

```json
{
  "projectInfo": {
    "name": "Materials Selection App",
    "description": "...",
    "techStack": ["React", "TypeScript", "AWS Lambda", "DynamoDB", ...],
    "architecture": ["Serverless", "REST API", ...]
  },
  "architectureDecisions": [
    {
      "date": "2026-02-11",
      "decision": "Use DynamoDB for all data storage",
      "reasoning": "Cost-effective serverless database...",
      "tags": ["database", "serverless", "aws"]
    }
  ],
  "apiEndpoints": [...],
  "commonIssues": [...],
  "developmentNotes": [...]
}
```

### Personal Knowledge Schema

```json
{
  "profile": {
    "experience": "35+ years",
    "expertise": [...],
    "preferredLanguages": ["TypeScript", "Python", "PowerShell"],
    "preferredFrameworks": [...]
  },
  "codingPreferences": {
    "style": [...],
    "patterns": [...],
    "antiPatterns": [...],
    "bestPractices": [...]
  },
  "commonSolutions": [
    {
      "problem": "CORS errors in API Gateway",
      "solution": "Configure OPTIONS method...",
      "tags": ["aws", "api-gateway", "cors"],
      "frequency": 1
    }
  ],
  "snippets": [...],
  "toolsAndCommands": [...],
  "learningNotes": [...]
}
```

---

## Updating Knowledge

### Manual Editing

Simply open the JSON files in VS Code and edit them directly. They're formatted for readability.

### Via Copilot

Ask Copilot to update knowledge during your session:

**Examples**:

- "Add this architecture decision to project knowledge: We're using CloudFront for CDN because it integrates well with S3 and provides better performance than direct S3 access"
- "Save this CORS solution to my personal knowledge: For Lambda + API Gateway CORS, always set headers in both the Lambda response AND the API Gateway method response"
- "Document this API endpoint: POST /projects - Creates a new project in DynamoDB"
- "Add to my coding preferences: Always use environment variables for AWS resource ARNs"

At the end of your session, ask Copilot to write the updated knowledge back to the JSON files.

---

## Tips for Best Results

✅ **Start sessions with context**: Reference knowledge files in your first message  
✅ **Update regularly**: Add new learnings at the end of each session  
✅ **Be specific**: Include dates, reasoning, and tags for easier searching  
✅ **Backup personal knowledge**: It's only on your machine, consider syncing to cloud  
✅ **Commit project knowledge**: It's in git, commit updates so teammates benefit

---

## Upgrading to Full MCP (Future)

When the `@modelcontextprotocol/sdk` npm package becomes publicly available, this system can be upgraded to full MCP integration where Copilot automatically reads the knowledge at every session start without manual prompting

---

## Benefits

✅ **Simple** - Just JSON files, no dependencies, no npm installs  
✅ **Works immediately** - No waiting for MCP SDK availability  
✅ **Cross-session memory** - Knowledge persists between Copilot sessions  
✅ **Personalized responses** - Copilot knows your coding style and preferences  
✅ **Project continuity** - Architecture decisions and context preserved  
✅ **Solution library** - Reuse proven solutions across projects  
✅ **Portable** - Project knowledge in git, personal knowledge on your machine  
✅ **Editable** - Modify directly in VS Code or via Copilot  
✅ **No cloud dependency** - All knowledge stays on your machine  
✅ **Version controlled** - Project knowledge tracked in git for history

---

## Next Steps

1. **Explore the knowledge files**:

   ```powershell
   code .\.mcp\project-knowledge\knowledge.json
   code C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json
   ```

2. **Try the view scripts**:

   ```powershell
   .\.mcp\scripts\view-project-knowledge.ps1
   .\.mcp\scripts\view-personal-knowledge.ps1
   ```

3. **Search for something**:

   ```powershell
   .\.mcp\scripts\search-knowledge.ps1 -Query "DynamoDB" -Scope Both
   ```

4. **Use in your next Copilot session**:
   Start with: "Read my knowledge files to understand my preferences and this project"

5. **Build the habit**:
   - Reference knowledge at session start
   - Update knowledge at session end
   - Search before solving problems you've seen before

---

## Example Workflow

**Session Start**:

```
Me: Read my personal knowledge from C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json
    and project knowledge from .mcp/project-knowledge/knowledge.json

Copilot: [Reads files and acknowledges your preferences and project context]

Me: I need to add a new API endpoint for managing vendors...

Copilot: [Suggests implementation knowing your tech stack, patterns, and preferences]
```

**Session End**:

```
Me: Update project knowledge with the new vendors endpoint we just created

Copilot: [Updates .mcp/project-knowledge/knowledge.json with the new endpoint]
```

The knowledge bases will grow richer over time, making Copilot more helpful with each session!
