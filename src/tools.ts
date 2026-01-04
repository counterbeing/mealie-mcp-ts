import { z } from 'zod';
import type { MealieApi } from './api.js';
import type { ToolName } from './config.js';
import {
  createRecipeInputSchema,
  shoppingListItemInputSchema,
  updateRecipeInputSchema,
} from './types.js';

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodType;
  handler: (api: MealieApi, input: unknown) => Promise<unknown>;
}

// List Recipes Tool
const listRecipesSchema = z.object({
  page: z.number().optional().default(1).describe('Page number (default: 1)'),
  perPage: z
    .number()
    .optional()
    .default(50)
    .describe('Items per page (default: 50)'),
});

export const listRecipesTool: ToolDefinition = {
  name: 'list_recipes',
  description:
    'List all recipes in Mealie. Returns recipe summaries with name, slug, description, and metadata.',
  inputSchema: listRecipesSchema,
  handler: async (api, input) => {
    const params = listRecipesSchema.parse(input);
    const result = await api.listRecipes(params.page, params.perPage);
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      recipes: result.items.map((r) => ({
        name: r.name,
        slug: r.slug,
        description: r.description,
        totalTime: r.totalTime,
        rating: r.rating,
        dateAdded: r.dateAdded,
      })),
    };
  },
};

// Get Recipe Tool
const getRecipeSchema = z.object({
  slug: z.string().describe('Recipe slug (unique identifier)'),
});

export const getRecipeTool: ToolDefinition = {
  name: 'get_recipe',
  description:
    'Get a recipe by its slug. Returns full recipe details including ingredients and instructions.',
  inputSchema: getRecipeSchema,
  handler: async (api, input) => {
    const params = getRecipeSchema.parse(input);
    const recipe = await api.getRecipe(params.slug);
    return {
      name: recipe.name,
      slug: recipe.slug,
      description: recipe.description,
      recipeYield: recipe.recipeYield,
      totalTime: recipe.totalTime,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      rating: recipe.rating,
      ingredients: recipe.recipeIngredient?.map((i) => ({
        quantity: i.quantity,
        unit: i.unit?.name,
        food: i.food?.name,
        note: i.note,
        title: i.title,
        display: i.display,
      })),
      instructions: recipe.recipeInstructions?.map((s) => ({
        title: s.title,
        text: s.text,
      })),
      categories: recipe.recipeCategory?.map((c) => c.name),
      tags: recipe.tags?.map((t) => t.name),
      notes: recipe.notes?.map((n) => ({ title: n.title, text: n.text })),
    };
  },
};

// Create Recipe Tool
export const createRecipeTool: ToolDefinition = {
  name: 'create_recipe',
  description:
    'Create a new recipe with name, ingredients, and instructions. Ingredients support quantity, unit, food, and notes. Instructions support section titles and text.',
  inputSchema: createRecipeInputSchema,
  handler: async (api, input) => {
    const params = createRecipeInputSchema.parse(input);
    const slug = await api.createRecipe(params);
    return {
      success: true,
      slug,
      message: `Recipe "${params.name}" created successfully`,
    };
  },
};

// Update Recipe Tool
export const updateRecipeTool: ToolDefinition = {
  name: 'update_recipe',
  description:
    'Update an existing recipe by slug. Only provided fields will be updated.',
  inputSchema: updateRecipeInputSchema,
  handler: async (api, input) => {
    const params = updateRecipeInputSchema.parse(input);
    const recipe = await api.updateRecipe(params);
    return {
      success: true,
      slug: recipe.slug,
      message: `Recipe "${recipe.name}" updated successfully`,
    };
  },
};

// Delete Recipe Tool
const deleteRecipeSchema = z.object({
  slug: z.string().describe('Recipe slug to delete'),
});

export const deleteRecipeTool: ToolDefinition = {
  name: 'delete_recipe',
  description: 'Delete a recipe by its slug. This action cannot be undone.',
  inputSchema: deleteRecipeSchema,
  handler: async (api, input) => {
    const params = deleteRecipeSchema.parse(input);
    await api.deleteRecipe(params.slug);
    return {
      success: true,
      message: `Recipe "${params.slug}" deleted successfully`,
    };
  },
};

// Upload Recipe Image Tool
const uploadRecipeImageSchema = z.object({
  slug: z.string().describe('Recipe slug'),
  imageBase64: z.string().describe('Base64-encoded image data'),
  fileName: z
    .string()
    .optional()
    .default('image.jpg')
    .describe('File name with extension (default: image.jpg)'),
});

export const uploadRecipeImageTool: ToolDefinition = {
  name: 'upload_recipe_image',
  description:
    'Upload an image for a recipe. Provide the image as base64-encoded data.',
  inputSchema: uploadRecipeImageSchema,
  handler: async (api, input) => {
    const params = uploadRecipeImageSchema.parse(input);
    await api.uploadRecipeImage(
      params.slug,
      params.imageBase64,
      params.fileName,
    );
    return {
      success: true,
      message: `Image uploaded for recipe "${params.slug}"`,
    };
  },
};

// List Foods Tool
const listFoodsSchema = z.object({
  page: z.number().optional().default(1).describe('Page number (default: 1)'),
  perPage: z
    .number()
    .optional()
    .default(50)
    .describe('Items per page (default: 50)'),
  search: z.string().optional().describe('Search term to filter foods'),
});

export const listFoodsTool: ToolDefinition = {
  name: 'list_foods',
  description:
    'List all foods/ingredients in Mealie. Can be filtered by search term.',
  inputSchema: listFoodsSchema,
  handler: async (api, input) => {
    const params = listFoodsSchema.parse(input);
    const result = await api.listFoods(
      params.page,
      params.perPage,
      params.search,
    );
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      foods: result.items.map((f) => ({
        id: f.id,
        name: f.name,
        pluralName: f.pluralName,
        description: f.description,
      })),
    };
  },
};

// Create Food Tool
const createFoodSchema = z.object({
  name: z.string().describe('Name of the food'),
  pluralName: z.string().optional().describe('Plural form of the name'),
  description: z.string().optional().describe('Description of the food'),
});

export const createFoodTool: ToolDefinition = {
  name: 'create_food',
  description: 'Create a new food/ingredient in Mealie.',
  inputSchema: createFoodSchema,
  handler: async (api, input) => {
    const params = createFoodSchema.parse(input);
    const food = await api.createFood(
      params.name,
      params.pluralName,
      params.description,
    );
    return {
      success: true,
      food: {
        id: food.id,
        name: food.name,
        pluralName: food.pluralName,
        description: food.description,
      },
      message: `Food "${params.name}" created successfully`,
    };
  },
};

// List Shopping Lists Tool
const listShoppingListsSchema = z.object({
  page: z.number().optional().default(1).describe('Page number (default: 1)'),
  perPage: z
    .number()
    .optional()
    .default(50)
    .describe('Items per page (default: 50)'),
});

export const listShoppingListsTool: ToolDefinition = {
  name: 'list_shopping_lists',
  description: 'List all shopping lists in Mealie.',
  inputSchema: listShoppingListsSchema,
  handler: async (api, input) => {
    const params = listShoppingListsSchema.parse(input);
    const result = await api.listShoppingLists(params.page, params.perPage);
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      shoppingLists: result.items.map((l) => ({
        id: l.id,
        name: l.name,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    };
  },
};

// Get Shopping List Tool
const getShoppingListSchema = z.object({
  id: z.string().uuid().describe('Shopping list ID'),
});

export const getShoppingListTool: ToolDefinition = {
  name: 'get_shopping_list',
  description: 'Get a shopping list by ID. Returns the list with all items.',
  inputSchema: getShoppingListSchema,
  handler: async (api, input) => {
    const params = getShoppingListSchema.parse(input);
    const list = await api.getShoppingList(params.id);
    return {
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      items: list.listItems.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        unit: i.unit?.name,
        food: i.food?.name,
        note: i.note,
        display: i.display,
        checked: i.checked,
      })),
      recipeReferences: list.recipeReferences.map((r) => ({
        recipeId: r.recipeId,
        recipeName: r.recipe?.name,
        quantity: r.recipeQuantity,
      })),
    };
  },
};

// Add Shopping List Item Tool
export const addShoppingListItemTool: ToolDefinition = {
  name: 'add_shopping_list_item',
  description:
    'Add an item to a shopping list. Can specify quantity, unit, food, or just a note.',
  inputSchema: shoppingListItemInputSchema,
  handler: async (api, input) => {
    const params = shoppingListItemInputSchema.parse(input);
    const item = await api.addShoppingListItem(params);
    return {
      success: true,
      item: {
        id: item.id,
        quantity: item.quantity,
        unit: item.unit?.name,
        food: item.food?.name,
        note: item.note,
        checked: item.checked,
      },
      message: 'Item added to shopping list',
    };
  },
};

// Export all tools
export const allTools: ToolDefinition[] = [
  listRecipesTool,
  getRecipeTool,
  createRecipeTool,
  updateRecipeTool,
  deleteRecipeTool,
  uploadRecipeImageTool,
  listFoodsTool,
  createFoodTool,
  listShoppingListsTool,
  getShoppingListTool,
  addShoppingListItemTool,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}
