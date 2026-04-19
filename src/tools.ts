import { z } from 'zod';
import { type MealieApi, MealieApiError } from './api.js';
import type { ToolName } from './config.js';
import {
  addRecipeToListInputSchema,
  createMealPlanInputSchema,
  createRecipeInputSchema,
  shoppingListItemInputSchema,
  updateRecipeInputSchema,
  updateShoppingListItemInputSchema,
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
    const [result, groupSlug] = await Promise.all([
      api.listRecipes(params.page, params.perPage),
      api.getGroupSlug(),
    ]);
    const baseUrl = api.getBaseUrl();
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      recipes: result.items.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        totalTime: r.totalTime,
        rating: r.rating,
        dateAdded: r.dateAdded,
        groupId: r.groupId,
        householdId: r.householdId,
        url: `${baseUrl}/g/${groupSlug}/r/${r.slug}`,
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
    const [recipe, groupSlug] = await Promise.all([
      api.getRecipe(params.slug),
      api.getGroupSlug(),
    ]);
    const baseUrl = api.getBaseUrl();
    return {
      id: recipe.id,
      name: recipe.name,
      slug: recipe.slug,
      description: recipe.description,
      recipeYield: recipe.recipeYield,
      totalTime: recipe.totalTime,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      rating: recipe.rating,
      groupId: recipe.groupId,
      householdId: recipe.householdId,
      url: `${baseUrl}/g/${groupSlug}/r/${recipe.slug}`,
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
    'Create a new recipe with name, ingredients, and instructions. For ingredients, prefer passing originalText (e.g. "2 cups flour") and let the server parse — the structured {quantity, unit, food} form also works but originalText is simpler and handles unknown units/foods automatically.',
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
    'Update an existing recipe by slug. Only provided fields will be updated. For ingredients, prefer passing originalText (e.g. "2 cups flour") over structured {quantity, unit, food} — the server parses originalText and auto-resolves unit+food. Structured form also works and is auto-normalized, but originalText is simpler.',
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

// ============ Categories ============

const listCategoriesSchema = z.object({
  page: z.number().optional().default(1).describe('Page number (default: 1)'),
  perPage: z
    .number()
    .optional()
    .default(50)
    .describe('Items per page (default: 50)'),
  search: z.string().optional().describe('Search term to filter categories'),
});

export const listCategoriesTool: ToolDefinition = {
  name: 'list_categories',
  description:
    'List all recipe categories in Mealie. Categories help organize recipes into groups like "Dinner", "Breakfast", "Italian", etc.',
  inputSchema: listCategoriesSchema,
  handler: async (api, input) => {
    const params = listCategoriesSchema.parse(input);
    const result = await api.listCategories(
      params.page,
      params.perPage,
      params.search,
    );
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      categories: result.items.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
    };
  },
};

const createCategorySchema = z.object({
  name: z
    .string()
    .describe(
      'Name of the category (e.g., "Dinner", "Italian", "Quick Meals")',
    ),
});

export const createCategoryTool: ToolDefinition = {
  name: 'create_category',
  description:
    'Create a new recipe category in Mealie. Categories help organize recipes into logical groups.',
  inputSchema: createCategorySchema,
  handler: async (api, input) => {
    const params = createCategorySchema.parse(input);
    const category = await api.createCategory(params.name);
    return {
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
      message: `Category "${params.name}" created successfully`,
    };
  },
};

// ============ Tags ============

const listTagsSchema = z.object({
  page: z.number().optional().default(1).describe('Page number (default: 1)'),
  perPage: z
    .number()
    .optional()
    .default(50)
    .describe('Items per page (default: 50)'),
  search: z.string().optional().describe('Search term to filter tags'),
});

export const listTagsTool: ToolDefinition = {
  name: 'list_tags',
  description:
    'List all recipe tags in Mealie. Tags provide flexible labeling for recipes like "vegetarian", "gluten-free", "kid-friendly", etc.',
  inputSchema: listTagsSchema,
  handler: async (api, input) => {
    const params = listTagsSchema.parse(input);
    const result = await api.listTags(
      params.page,
      params.perPage,
      params.search,
    );
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      tags: result.items.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
    };
  },
};

const createTagSchema = z.object({
  name: z
    .string()
    .describe('Name of the tag (e.g., "vegetarian", "gluten-free", "quick")'),
});

export const createTagTool: ToolDefinition = {
  name: 'create_tag',
  description:
    'Create a new recipe tag in Mealie. Tags provide flexible labeling for recipes.',
  inputSchema: createTagSchema,
  handler: async (api, input) => {
    const params = createTagSchema.parse(input);
    const tag = await api.createTag(params.name);
    return {
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      },
      message: `Tag "${params.name}" created successfully`,
    };
  },
};

// ============ Recipe URL Scraping ============

const testScrapeUrlSchema = z.object({
  url: z.string().url().describe('URL of the recipe page to test scraping'),
});

export const testScrapeUrlTool: ToolDefinition = {
  name: 'test_scrape_url',
  description:
    'Test if a URL can be scraped for recipe data without actually creating a recipe. Useful for validating URLs before importing. Returns success:false when the scraper cannot parse the site.',
  inputSchema: testScrapeUrlSchema,
  handler: async (api, input) => {
    const params = testScrapeUrlSchema.parse(input);
    const result = await api.testScrapeUrl(params.url);
    // Mealie returns a string like "recipe_scrapers was unable to scrape this URL"
    // when the scraper can't parse the site, and a structured object on success.
    const scrapeFailed = typeof result === 'string' || !result;
    return {
      success: !scrapeFailed,
      url: params.url,
      scrapedData: result,
      message: scrapeFailed
        ? `Mealie's scraper cannot parse this URL: ${typeof result === 'string' ? result : 'empty response'}. The site's schema.org recipe markup may be missing or non-standard. Try a URL from a well-supported site (allrecipes.com, nytimes.com/cooking, foodnetwork.com, seriouseats.com, bbcgoodfood.com) or fetch the content manually and use create_recipe.`
        : 'URL scrape test completed successfully',
    };
  },
};

const createRecipeFromUrlSchema = z.object({
  url: z.string().url().describe('URL of the recipe page to import'),
  includeTags: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to import tags from the recipe page'),
});

export const createRecipeFromUrlTool: ToolDefinition = {
  name: 'create_recipe_from_url',
  description:
    'Create a new recipe by scraping data from a URL. Supports most recipe websites that use structured data (schema.org Recipe format). On failure, returns success:false with diagnostic info — check that before retrying or falling back to create_recipe.',
  inputSchema: createRecipeFromUrlSchema,
  handler: async (api, input) => {
    const params = createRecipeFromUrlSchema.parse(input);
    try {
      const slug = await api.createRecipeFromUrl(
        params.url,
        params.includeTags,
      );
      return {
        success: true,
        slug,
        message: `Recipe imported successfully from ${params.url}`,
      };
    } catch (error) {
      if (error instanceof MealieApiError && error.statusCode === 400) {
        // Mealie's 400 is opaque. Probe the scraper to surface the real reason.
        let scraperDetail: string | null = null;
        try {
          const scrapeResult = await api.testScrapeUrl(params.url);
          if (typeof scrapeResult === 'string') {
            scraperDetail = scrapeResult;
          }
        } catch {
          // Ignore diagnostic failures; fall through with whatever we know.
        }
        return {
          success: false,
          url: params.url,
          reason: scraperDetail
            ? 'scraper_unsupported_site'
            : 'mealie_rejected_url',
          scraperOutput: scraperDetail,
          statusCode: error.statusCode,
          message: scraperDetail
            ? `Mealie's scraper cannot parse this URL: "${scraperDetail}". Try a URL from a well-supported site (allrecipes.com, nytimes.com/cooking, foodnetwork.com, seriouseats.com, bbcgoodfood.com), or fetch the recipe content manually and use create_recipe with structured ingredients and instructions. Do NOT retry create_recipe_from_url on the same URL.`
            : `Mealie rejected the URL import (400). The URL may be malformed or inaccessible. Consider fetching the page manually and using create_recipe.`,
        };
      }
      throw error;
    }
  },
};

// ============ Meal Planning ============

const listMealPlansSchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe('Start date for filtering (YYYY-MM-DD format)'),
  endDate: z
    .string()
    .optional()
    .describe('End date for filtering (YYYY-MM-DD format)'),
});

export const listMealPlansTool: ToolDefinition = {
  name: 'list_meal_plans',
  description:
    'List meal plan entries within a date range. If no dates provided, returns all meal plans.',
  inputSchema: listMealPlansSchema,
  handler: async (api, input) => {
    const params = listMealPlansSchema.parse(input);
    const result = await api.listMealPlans(params.startDate, params.endDate);
    return {
      page: result.page,
      perPage: result.per_page,
      total: result.total,
      totalPages: result.total_pages,
      mealPlans: result.items.map((mp) => ({
        id: mp.id,
        date: mp.date,
        entryType: mp.entryType,
        title: mp.title,
        text: mp.text,
        recipeId: mp.recipeId,
        recipeName: mp.recipe?.name,
        recipeSlug: mp.recipe?.slug,
      })),
    };
  },
};

const getTodaysMealPlanSchema = z.object({});

export const getTodaysMealPlanTool: ToolDefinition = {
  name: 'get_todays_meal_plan',
  description:
    "Get today's meal plan entries. Returns all meals planned for the current day.",
  inputSchema: getTodaysMealPlanSchema,
  handler: async (api, _input) => {
    const entries = await api.getTodaysMealPlan();
    return {
      date: new Date().toISOString().split('T')[0],
      meals: entries.map((mp) => ({
        id: mp.id,
        entryType: mp.entryType,
        title: mp.title,
        text: mp.text,
        recipeId: mp.recipeId,
        recipeName: mp.recipe?.name,
        recipeSlug: mp.recipe?.slug,
      })),
    };
  },
};

export const createMealPlanTool: ToolDefinition = {
  name: 'create_meal_plan',
  description:
    'Create a new meal plan entry for a specific date. Can optionally link to an existing recipe.',
  inputSchema: createMealPlanInputSchema,
  handler: async (api, input) => {
    const params = createMealPlanInputSchema.parse(input);
    const entry = await api.createMealPlan(params);
    return {
      success: true,
      mealPlan: {
        id: entry.id,
        date: entry.date,
        entryType: entry.entryType,
        title: entry.title,
        text: entry.text,
        recipeId: entry.recipeId,
      },
      message: `Meal plan entry created for ${params.date}`,
    };
  },
};

const deleteMealPlanSchema = z.object({
  itemId: z.number().describe('ID of the meal plan entry to delete'),
});

export const deleteMealPlanTool: ToolDefinition = {
  name: 'delete_meal_plan',
  description: 'Delete a meal plan entry by its ID.',
  inputSchema: deleteMealPlanSchema,
  handler: async (api, input) => {
    const params = deleteMealPlanSchema.parse(input);
    await api.deleteMealPlan(params.itemId);
    return {
      success: true,
      message: `Meal plan entry ${params.itemId} deleted successfully`,
    };
  },
};

// ============ Shopping List Improvements ============

export const updateShoppingListItemTool: ToolDefinition = {
  name: 'update_shopping_list_item',
  description:
    'Update a shopping list item. Can modify quantity, note, or checked status (to mark items as purchased).',
  inputSchema: updateShoppingListItemInputSchema,
  handler: async (api, input) => {
    const params = updateShoppingListItemInputSchema.parse(input);
    const item = await api.updateShoppingListItem(params.itemId, {
      quantity: params.quantity,
      note: params.note,
      checked: params.checked,
    });
    return {
      success: true,
      item: {
        id: item.id,
        quantity: item.quantity,
        note: item.note,
        checked: item.checked,
      },
      message: 'Shopping list item updated successfully',
    };
  },
};

const deleteShoppingListItemSchema = z.object({
  itemId: z.string().uuid().describe('ID of the shopping list item to delete'),
});

export const deleteShoppingListItemTool: ToolDefinition = {
  name: 'delete_shopping_list_item',
  description: 'Remove an item from a shopping list.',
  inputSchema: deleteShoppingListItemSchema,
  handler: async (api, input) => {
    const params = deleteShoppingListItemSchema.parse(input);
    await api.deleteShoppingListItem(params.itemId);
    return {
      success: true,
      message: `Shopping list item deleted successfully`,
    };
  },
};

export const addRecipeToShoppingListTool: ToolDefinition = {
  name: 'add_recipe_to_shopping_list',
  description:
    'Add all ingredients from a recipe to a shopping list. Optionally specify quantity for multiple servings.',
  inputSchema: addRecipeToListInputSchema,
  handler: async (api, input) => {
    const params = addRecipeToListInputSchema.parse(input);
    const list = await api.addRecipeToShoppingList(params);
    return {
      success: true,
      shoppingList: {
        id: list.id,
        name: list.name,
        itemCount: list.listItems.length,
      },
      message: 'Recipe ingredients added to shopping list',
    };
  },
};

// Get current user tool (for debugging group context)
const getCurrentUserSchema = z.object({});

export const getCurrentUserTool: ToolDefinition = {
  name: 'get_current_user',
  description:
    'Get information about the current API user, including their group and household. Useful for debugging permission issues when recipes or other items are not visible.',
  inputSchema: getCurrentUserSchema,
  handler: async (api) => {
    const user = await api.getCurrentUser();
    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        admin: user.admin,
      },
      group: {
        name: user.group,
        id: user.groupId,
        slug: user.groupSlug,
      },
      household: {
        name: user.household,
        id: user.householdId,
        slug: user.householdSlug,
      },
      note: 'Recipes and other data are scoped to this group. Ensure your browser session is viewing the same group.',
    };
  },
};

// Export all tools
export const allTools: ToolDefinition[] = [
  // Recipe tools
  listRecipesTool,
  getRecipeTool,
  createRecipeTool,
  updateRecipeTool,
  deleteRecipeTool,
  uploadRecipeImageTool,
  // Food tools
  listFoodsTool,
  createFoodTool,
  // Shopping list tools
  listShoppingListsTool,
  getShoppingListTool,
  addShoppingListItemTool,
  updateShoppingListItemTool,
  deleteShoppingListItemTool,
  addRecipeToShoppingListTool,
  // Category tools
  listCategoriesTool,
  createCategoryTool,
  // Tag tools
  listTagsTool,
  createTagTool,
  // Recipe URL scraping tools
  testScrapeUrlTool,
  createRecipeFromUrlTool,
  // Meal planning tools
  listMealPlansTool,
  getTodaysMealPlanTool,
  createMealPlanTool,
  deleteMealPlanTool,
  // User/debug tools
  getCurrentUserTool,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}
