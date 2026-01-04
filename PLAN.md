# MCP Server for Mealie

## Overview

Build an MCP server that lets LLMs interact with Mealie (meal planning and recipe management). The server should support:

- View/create/edit/delete recipes
- Create foods
- View shopping lists and add items
- Parsed ingredients (quantity, unit, food, note)
- Image uploads for recipes
- Sections for ingredients and instructions

## Technical Stack

- Node.js with TypeScript (strict mode)
- pnpm for package management
- Zod for validation
- Biome for formatting/linting
- Docker for deployment

## API Reference

- `openapi.json` - Mealie OpenAPI specification (use for endpoints and schemas)
- Auth: `Authorization: Bearer <API_KEY>` header

---

## Phase 1: Project Setup

Set up the project structure with pnpm, TypeScript, Biome, and a local Mealie instance for testing.

### Verification

- [ ] `pnpm install` succeeds
- [ ] `pnpm run build` compiles without errors
- [ ] `pnpm run lint` passes
- [ ] Local Mealie running via docker-compose at <http://localhost:9925>
- [ ] `.env.example` documents required variables: `MEALIE_URL`, `MEALIE_API_KEY`, `ENABLED_TOOLS`

---

## Phase 2: Configuration & Types

Create Zod-validated config from environment variables and type definitions matching the Mealie API schemas from `openapi.json`.

### Verification

- [ ] Config validates env vars with descriptive errors
- [ ] Types cover: Recipe, Ingredient, Instruction, Food, ShoppingList, ShoppingListItem
- [ ] Types match `openapi.json` schemas

---

## Phase 3: Mealie API Client

Build a typed API client for Mealie. Reference `openapi.json` for endpoints.

### Required Functions

- Recipes: list, get, create, update, delete, upload image
- Foods: list, create
- Shopping Lists: list, get, add item

### Verification

- [ ] All functions compile with proper types
- [ ] API calls work against local Mealie instance
- [ ] Errors are descriptive

---

## Phase 4: MCP Server

Set up the MCP server with `@modelcontextprotocol/sdk` using stdio transport.

### Verification

- [ ] Server starts without errors
- [ ] `ENABLED_TOOLS` config filters available tools
- [ ] Handles missing/invalid config gracefully

---

## Phase 5: Tools

Implement MCP tools for all API functionality.

### Required Tools

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes |
| `get_recipe` | Get recipe by slug |
| `create_recipe` | Create recipe with ingredients/instructions |
| `update_recipe` | Update existing recipe |
| `delete_recipe` | Delete recipe |
| `upload_recipe_image` | Upload image (base64) to recipe |
| `list_foods` | List all foods |
| `create_food` | Create new food |
| `list_shopping_lists` | List all shopping lists |
| `get_shopping_list` | Get shopping list with items |
| `add_shopping_list_item` | Add item to shopping list |

### Verification

- [ ] All 11 tools register and respond correctly
- [ ] Input validation with Zod
- [ ] Tools work against local Mealie instance
- [ ] Tool filtering via `ENABLED_TOOLS` works
- [ ] Build passes

---

## Phase 6: Docker & Docs

Create production Dockerfile and minimal README.

### Verification

- [ ] `docker build` succeeds
- [ ] Container runs and responds to MCP protocol
- [ ] README covers: install, config, tools, docker usage

---

## Completion

When all phases pass:

**OUTPUT: MEALIE_MCP_COMPLETE**
