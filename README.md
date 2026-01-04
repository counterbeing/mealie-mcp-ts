# Mealie MCP Server

An MCP (Model Context Protocol) server that enables LLMs to interact with [Mealie](https://mealie.io) - a self-hosted recipe manager and meal planner.

## Features

- **Recipe Management**: List, view, create, update, and delete recipes
- **Ingredient Parsing**: Support for quantity, unit, food, and notes in ingredients
- **Image Uploads**: Upload images to recipes via base64 encoding
- **Shopping Lists**: View shopping lists and add items
- **Food Management**: List and create food items

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/mealie-mcp.git
cd mealie-mcp

# Install dependencies
pnpm install

# Build
pnpm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `MEALIE_URL` | URL of your Mealie instance (e.g., `http://localhost:9925`) |
| `MEALIE_API_KEY` | API key from Mealie (Settings → API Tokens) |
| `ENABLED_TOOLS` | (Optional) Comma-separated list of tools to enable |

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mealie": {
      "command": "node",
      "args": ["/path/to/mealie-mcp/dist/index.js"],
      "env": {
        "MEALIE_URL": "http://localhost:9925",
        "MEALIE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### With Docker

```bash
# Build the image
docker build -t mealie-mcp .

# Run with environment variables
docker run -e MEALIE_URL=http://host.docker.internal:9925 \
           -e MEALIE_API_KEY=your-api-key \
           mealie-mcp
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes with pagination |
| `get_recipe` | Get full recipe details by slug |
| `create_recipe` | Create a new recipe with ingredients and instructions |
| `update_recipe` | Update an existing recipe |
| `delete_recipe` | Delete a recipe |
| `upload_recipe_image` | Upload an image to a recipe (base64) |
| `list_foods` | List all foods/ingredients |
| `create_food` | Create a new food item |
| `list_shopping_lists` | List all shopping lists |
| `get_shopping_list` | Get shopping list with items |
| `add_shopping_list_item` | Add an item to a shopping list |

## Development

```bash
# Run in development mode
pnpm run dev

# Lint
pnpm run lint

# Format
pnpm run format

# Build
pnpm run build
```

### Local Mealie Instance

Start a local Mealie instance for testing:

```bash
docker-compose up -d
```

This starts Mealie at `http://localhost:9925`.

## License

MIT
