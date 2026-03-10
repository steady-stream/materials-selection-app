# Knowledge System - Quick Reference

## 📁 Files

**Project Knowledge**: [.mcp/project-knowledge/knowledge.json](.mcp/project-knowledge/knowledge.json)  
**Personal Knowledge**: `C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json`

## 🔍 PowerShell Commands

```powershell
# View all project knowledge
.\.mcp\scripts\view-project-knowledge.ps1

# View all personal knowledge
.\.mcp\scripts\view-personal-knowledge.ps1

# Search project knowledge
.\.mcp\scripts\search-knowledge.ps1 -Query "CORS" -Scope Project

# Search personal knowledge
.\.mcp\scripts\search-knowledge.ps1 -Query "Lambda" -Scope Personal

# Search both
.\.mcp\scripts\search-knowledge.ps1 -Query "DynamoDB" -Scope Both
```

## 💬 Using with Copilot

**Start of session** (paste this):

```
Read my personal knowledge from C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json
and project knowledge from .mcp/project-knowledge/knowledge.json
```

**During session**:

- "What architecture decisions have we made?"
- "What are my coding preferences?"
- "Search project knowledge for [topic]"

**End of session**:

- "Update project knowledge with [new info]"
- "Add this architecture decision: [decision and reasoning]"
- "Save this solution to my personal knowledge"

## ✏️ Direct Editing

Open JSON files in VS Code and edit directly:

```powershell
code .\.mcp\project-knowledge\knowledge.json
code C:\Users\apia-jstur\.mcp\personal-knowledge\personal-knowledge.json
```

## 📊 What's Stored

**Project Knowledge**:

- Tech stack & architecture
- API endpoints
- Architecture decisions
- Common issues
- Development notes

**Personal Knowledge**:

- Your profile (35+ years exp)
- Coding preferences & patterns
- Common solutions (tracked by frequency)
- Code snippets
- Tools & commands
- Learning notes

## 💡 Tips

✅ Reference knowledge at session start for better context  
✅ Update knowledge at session end to capture learnings  
✅ Search before solving - you may have solved it before  
✅ Be specific with dates, reasoning, and tags  
✅ Commit project knowledge updates to git  
✅ Backup personal knowledge (it's only on your machine)
