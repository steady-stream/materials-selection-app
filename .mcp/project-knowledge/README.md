# Materials Selection MCP Knowledge Server

This MCP server maintains project knowledge across Copilot sessions.

## What It Does

- **Stores project context**: Tech stack, architecture, API endpoints
- **Remembers your preferences**: Coding style, patterns, experience level
- **Tracks architecture decisions**: What was decided and why
- **Documents common issues**: Solutions to recurring problems
- **Development notes**: General notes categorized by topic

## Setup

1. Install dependencies:
   ```powershell
   cd .mcp\project-knowledge
   npm install
   ```

2. Build the server:
   ```powershell
   npm run build
   ```

3. VS Code will automatically connect to this server (configured in settings)

## How It Works

The MCP server provides:

### Resources (Read-only access)
- `knowledge://project-info` - Project details
- `knowledge://developer-preferences` - Your coding preferences
- `knowledge://architecture-decisions` - Historical decisions
- `knowledge://api-endpoints` - API documentation
- `knowledge://all` - Complete knowledge base

### Tools (Can modify knowledge)
- `add_architecture_decision` - Record design decisions
- `add_api_endpoint` - Document API endpoints
- `add_common_issue` - Save issue/solution pairs
- `add_development_note` - General notes
- `update_project_info` - Update project details
- `search_knowledge` - Search all knowledge

## Benefits

- **Cross-session continuity**: Copilot remembers project context
- **Better suggestions**: AI knows your preferences and patterns
- **Institutional memory**: Architecture decisions preserved
- **Problem-solving**: Common issues and solutions readily available

## Data Storage

All knowledge is stored in `knowledge.json` in this directory. You can:
- Edit it manually if needed
- Back it up to preserve project history
- Version control it (already in git)

## Usage in Copilot

Once configured, Copilot will automatically:
- Read your preferences at session start
- Reference architecture decisions when relevant
- Suggest solutions based on common issues
- Maintain context about your project setup

You can also explicitly ask:
- "What architecture decisions have we made?"
- "What are the API endpoints?"
- "Search knowledge for CORS"
