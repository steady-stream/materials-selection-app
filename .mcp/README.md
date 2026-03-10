# Knowledge Management System

Simple JSON-based knowledge persistence for cross-session AI assistance.

## Overview

This system uses plain JSON files to store knowledge that can be referenced across Copilot sessions.

**Two knowledge bases**:

1. **Project Knowledge** - Specific to Materials Selection App
2. **Personal Knowledge** - Your preferences across all projects

## Files

### Project Knowledge

- **Location**: `.mcp/project-knowledge/knowledge.json`
- **Contains**: Architecture, API endpoints, decisions for this project
- **Travels with**: This git repository

### Personal Knowledge

- **Location**: `C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json`
- **Contains**: Your coding preferences, common solutions, snippets
- **Travels with**: You (stays on your machine)

## Helper Scripts

### View Knowledge

```powershell
# View project knowledge
.\.mcp\scripts\view-project-knowledge.ps1

# View personal knowledge
.\.mcp\scripts\view-personal-knowledge.ps1

# Search project knowledge
.\.mcp\scripts\search-knowledge.ps1 -Query "CORS" -Scope Project

# Search personal knowledge
.\.mcp\scripts\search-knowledge.ps1 -Query "Lambda" -Scope Personal
```

### Update Knowledge

**Option 1**: Edit JSON files directly in VS Code

**Option 2**: Ask Copilot to update them:

- "Add this to project knowledge: [decision/endpoint/note]"
- "Save this solution to my personal knowledge"
- "Document this API endpoint in project knowledge"

**Option 3**: Use helper scripts (coming soon)

## Usage in Copilot Sessions

### At Session Start

Reference the knowledge in your first message:

> "Read my personal knowledge from C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json and project knowledge from .mcp/project-knowledge/knowledge.json"

### During Session

- Ask Copilot to read specific knowledge sections
- Request updates to knowledge bases
- Search for past decisions or solutions

### At Session End

- Have Copilot update knowledge.json files with new learnings
- Document architecture decisions made
- Save new solutions discovered

## Benefits

✅ **Simple** - Just JSON files, no dependencies  
✅ **Portable** - Project knowledge in git, personal knowledge on your machine  
✅ **Editable** - Modify directly in VS Code  
✅ **Version controlled** - Project knowledge tracked in git  
✅ **Works now** - No waiting for MCP SDK availability

## Knowledge Schema

See the JSON files for structure. Main sections:

**Project Knowledge**:

- `projectInfo` - Name, description, tech stack, architecture
- `architectureDecisions` - Historical decisions with reasoning
- `apiEndpoints` - Documented endpoints
- `commonIssues` - Project-specific issues and solutions
- `developmentNotes` - General notes

**Personal Knowledge**:

- `profile` - Your experience and expertise
- `codingPreferences` - Style, patterns, best practices
- `commonSolutions` - Reusable solutions
- `snippets` - Code snippets
- `toolsAndCommands` - Useful tools
- `learningNotes` - Things you've learned

## Automatic Session Integration (Future)

When MCP SDK becomes available, this can be upgraded to automatic integration with Copilot without manual "read knowledge" requests.
