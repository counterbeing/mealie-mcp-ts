# Mealie MCP Server

An MCP (Model Context Protocol) server that enables LLMs to interact with [Mealie](https://mealie.io) - a self-hosted recipe manager and meal planner.

## Features

- **Recipe Management**: List, view, create, update, and delete recipes
- **Recipe Import**: Import recipes from URLs (supports most recipe websites)
- **Ingredient Parsing**: Automatic parsing of natural language ingredients (e.g., "2 cups flour")
- **Image Uploads**: Upload images to recipes via base64 encoding
- **Meal Planning**: Create and manage meal plans with date scheduling
- **Shopping Lists**: Full CRUD for shopping list items, plus add recipe ingredients to lists
- **Organization**: Manage categories and tags for recipe organization
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

### Recipes (6 tools)

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes with pagination |
| `get_recipe` | Get full recipe details by slug |
| `create_recipe` | Create a new recipe with ingredients and instructions |
| `update_recipe` | Update an existing recipe |
| `delete_recipe` | Delete a recipe |
| `upload_recipe_image` | Upload an image to a recipe (base64) |

### Recipe Import (2 tools)

| Tool | Description |
|------|-------------|
| `test_scrape_url` | Test if a URL can be scraped for recipe data |
| `create_recipe_from_url` | Import a recipe by scraping a URL |

### Meal Planning (4 tools)

| Tool | Description |
|------|-------------|
| `list_meal_plans` | List meal plans with optional date range filter |
| `get_todays_meal_plan` | Get today's planned meals |
| `create_meal_plan` | Create a meal plan entry for a specific date |
| `delete_meal_plan` | Delete a meal plan entry |

### Shopping Lists (6 tools)

| Tool | Description |
|------|-------------|
| `list_shopping_lists` | List all shopping lists |
| `get_shopping_list` | Get shopping list with items |
| `add_shopping_list_item` | Add an item to a shopping list |
| `update_shopping_list_item` | Update an item (quantity, note, or check/uncheck) |
| `delete_shopping_list_item` | Remove an item from a shopping list |
| `add_recipe_to_shopping_list` | Add all ingredients from a recipe to a list |

### Organization (4 tools)

| Tool | Description |
|------|-------------|
| `list_categories` | List all recipe categories |
| `create_category` | Create a new category |
| `list_tags` | List all recipe tags |
| `create_tag` | Create a new tag |

### Foods (2 tools)

| Tool | Description |
|------|-------------|
| `list_foods` | List all foods/ingredients |
| `create_food` | Create a new food item |

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
