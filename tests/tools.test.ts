import { describe, expect, it, vi } from 'vitest';
import { MealieApiError } from '../src/api.js';
import {
  addRecipeToShoppingListTool,
  addShoppingListItemTool,
  allTools,
  createCategoryTool,
  createFoodTool,
  createMealPlanTool,
  createRecipeFromUrlTool,
  createRecipeTool,
  createTagTool,
  deleteMealPlanTool,
  deleteRecipeTool,
  deleteShoppingListItemTool,
  getCurrentUserTool,
  getRecipeTool,
  getShoppingListTool,
  getTodaysMealPlanTool,
  listCategoriesTool,
  listFoodsTool,
  listMealPlansTool,
  listRecipesTool,
  listShoppingListsTool,
  listTagsTool,
  testScrapeUrlTool,
  updateRecipeTool,
  updateShoppingListItemTool,
  uploadRecipeImageTool,
} from '../src/tools.js';
import type { ToolDefinition } from '../src/tools.js';

const UUID = '11111111-1111-4111-8111-111111111111';

// biome-ignore lint/suspicious/noExplicitAny: mock surface mirrors the full MealieApi
function createMockApi(): any {
  return {
    getBaseUrl: vi.fn().mockReturnValue('http://mealie.test'),
    getGroupSlug: vi.fn().mockResolvedValue('home'),
    buildRecipeUrl: vi.fn((slug: string) => `http://mealie.test/g/home/r/${slug}`),
    listRecipes: vi.fn(),
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
    uploadRecipeImage: vi.fn(),
    listFoods: vi.fn(),
    createFood: vi.fn(),
    listShoppingLists: vi.fn(),
    getShoppingList: vi.fn(),
    addShoppingListItem: vi.fn(),
    updateShoppingListItem: vi.fn(),
    deleteShoppingListItem: vi.fn(),
    addRecipeToShoppingList: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    listTags: vi.fn(),
    createTag: vi.fn(),
    testScrapeUrl: vi.fn(),
    createRecipeFromUrl: vi.fn(),
    listMealPlans: vi.fn(),
    getTodaysMealPlan: vi.fn(),
    createMealPlan: vi.fn(),
    deleteMealPlan: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper narrows the result via callers
async function runTool(
  tool: ToolDefinition,
  api: ReturnType<typeof createMockApi>,
  input: unknown,
): Promise<any> {
  return tool.handler(api, input);
}

describe('tool registry', () => {
  it('registers exactly 25 tools', () => {
    expect(allTools).toHaveLength(25);
  });

  it('every tool has a unique name', () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every tool has a non-empty description and input schema', () => {
    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

// ============ Recipes ============

describe('list_recipes', () => {
  it('returns paginated recipes with public URLs', async () => {
    const api = createMockApi();
    api.listRecipes.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [
        {
          id: UUID,
          name: 'Test Recipe',
          slug: 'test-recipe',
          description: 'A test',
          totalTime: '30m',
          rating: 5,
          dateAdded: '2026-01-01',
          groupId: 'g1',
          householdId: 'h1',
        },
      ],
    });

    const result = await runTool(listRecipesTool, api, { page: 1, perPage: 50 });

    expect(api.listRecipes).toHaveBeenCalledWith(1, 50);
    expect(result.total).toBe(1);
    expect(result.recipes[0].slug).toBe('test-recipe');
    expect(result.recipes[0].url).toBe('http://mealie.test/g/home/r/test-recipe');
  });

  it('applies default pagination when args omitted', async () => {
    const api = createMockApi();
    api.listRecipes.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
      items: [],
    });
    await runTool(listRecipesTool, api, {});
    expect(api.listRecipes).toHaveBeenCalledWith(1, 50);
  });
});

describe('get_recipe', () => {
  it('returns recipe with flattened ingredients and instructions', async () => {
    const api = createMockApi();
    api.getRecipe.mockResolvedValue({
      id: UUID,
      name: 'Pancakes',
      slug: 'pancakes',
      description: 'Fluffy',
      recipeYield: '4',
      totalTime: '20m',
      prepTime: '5m',
      cookTime: '15m',
      rating: 5,
      groupId: 'g1',
      householdId: 'h1',
      recipeIngredient: [
        {
          quantity: 1,
          unit: { name: 'cup' },
          food: { name: 'flour' },
          note: '',
          title: 'Dry',
          display: '1 cup flour',
        },
      ],
      recipeInstructions: [{ title: '', text: 'Mix.' }],
      recipeCategory: [{ name: 'Breakfast' }],
      tags: [{ name: 'vegetarian' }],
      notes: [{ title: 'Tip', text: 'Use buttermilk' }],
    });

    const result = await runTool(getRecipeTool, api, { slug: 'pancakes' });

    expect(result.ingredients).toEqual([
      { quantity: 1, unit: 'cup', food: 'flour', note: '', title: 'Dry', display: '1 cup flour' },
    ]);
    expect(result.instructions).toEqual([{ title: '', text: 'Mix.' }]);
    expect(result.categories).toEqual(['Breakfast']);
    expect(result.tags).toEqual(['vegetarian']);
    expect(result.url).toBe('http://mealie.test/g/home/r/pancakes');
  });

  it('rejects when slug missing', async () => {
    const api = createMockApi();
    await expect(runTool(getRecipeTool, api, {})).rejects.toThrow();
  });
});

describe('create_recipe', () => {
  it('creates recipe and returns slug', async () => {
    const api = createMockApi();
    api.createRecipe.mockResolvedValue('new-recipe');
    const result = await runTool(createRecipeTool, api, {
      name: 'New Recipe',
      recipeIngredient: [{ originalText: '2 cups flour' }],
      recipeInstructions: [{ text: 'Mix.' }],
    });
    expect(result.success).toBe(true);
    expect(result.slug).toBe('new-recipe');
    expect(api.createRecipe).toHaveBeenCalledOnce();
  });

  it('requires a name', async () => {
    const api = createMockApi();
    await expect(runTool(createRecipeTool, api, {})).rejects.toThrow();
  });
});

describe('update_recipe', () => {
  it('passes through update and returns new slug', async () => {
    const api = createMockApi();
    api.updateRecipe.mockResolvedValue({ slug: 'updated', name: 'Updated' });
    const result = await runTool(updateRecipeTool, api, {
      slug: 'old',
      name: 'Updated',
    });
    expect(result.success).toBe(true);
    expect(result.slug).toBe('updated');
  });
});

describe('delete_recipe', () => {
  it('calls deleteRecipe with the slug', async () => {
    const api = createMockApi();
    api.deleteRecipe.mockResolvedValue(undefined);
    const result = await runTool(deleteRecipeTool, api, { slug: 'old' });
    expect(api.deleteRecipe).toHaveBeenCalledWith('old');
    expect(result.success).toBe(true);
  });
});

describe('upload_recipe_image', () => {
  it('uploads with default filename when omitted', async () => {
    const api = createMockApi();
    api.uploadRecipeImage.mockResolvedValue(undefined);
    const result = await runTool(uploadRecipeImageTool, api, {
      slug: 'pancakes',
      imageBase64: 'deadbeef',
    });
    expect(api.uploadRecipeImage).toHaveBeenCalledWith('pancakes', 'deadbeef', 'image.jpg');
    expect(result.success).toBe(true);
  });

  it('passes explicit filename through', async () => {
    const api = createMockApi();
    api.uploadRecipeImage.mockResolvedValue(undefined);
    await runTool(uploadRecipeImageTool, api, {
      slug: 'pancakes',
      imageBase64: 'deadbeef',
      fileName: 'custom.png',
    });
    expect(api.uploadRecipeImage).toHaveBeenCalledWith('pancakes', 'deadbeef', 'custom.png');
  });
});

// ============ Foods ============

describe('list_foods', () => {
  it('forwards pagination and search', async () => {
    const api = createMockApi();
    api.listFoods.mockResolvedValue({
      page: 2,
      per_page: 10,
      total: 100,
      total_pages: 10,
      items: [{ id: UUID, name: 'Flour', pluralName: 'Flours', description: 'White' }],
    });
    const result = await runTool(listFoodsTool, api, {
      page: 2,
      perPage: 10,
      search: 'fl',
    });
    expect(api.listFoods).toHaveBeenCalledWith(2, 10, 'fl');
    expect(result.foods[0].name).toBe('Flour');
  });
});

describe('create_food', () => {
  it('creates a food with just a name', async () => {
    const api = createMockApi();
    api.createFood.mockResolvedValue({
      id: UUID,
      name: 'Salt',
      pluralName: undefined,
      description: undefined,
    });
    const result = await runTool(createFoodTool, api, { name: 'Salt' });
    expect(api.createFood).toHaveBeenCalledWith('Salt', undefined, undefined);
    expect(result.food.name).toBe('Salt');
    expect(result.success).toBe(true);
  });
});

// ============ Shopping lists ============

describe('list_shopping_lists', () => {
  it('returns summary rows', async () => {
    const api = createMockApi();
    api.listShoppingLists.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [
        {
          id: UUID,
          name: 'Weekly',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
        },
      ],
    });
    const result = await runTool(listShoppingListsTool, api, {});
    expect(result.shoppingLists[0].name).toBe('Weekly');
  });
});

describe('get_shopping_list', () => {
  it('flattens items and recipeReferences', async () => {
    const api = createMockApi();
    api.getShoppingList.mockResolvedValue({
      id: UUID,
      name: 'Weekly',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      listItems: [
        {
          id: UUID,
          quantity: 2,
          unit: { name: 'cup' },
          food: { name: 'flour' },
          note: '',
          display: '2 cup flour',
          checked: false,
        },
      ],
      recipeReferences: [
        {
          recipeId: UUID,
          recipeQuantity: 1,
          recipe: { name: 'Pancakes' },
        },
      ],
    });
    const result = await runTool(getShoppingListTool, api, { id: UUID });
    expect(result.items[0].food).toBe('flour');
    expect(result.recipeReferences[0].recipeName).toBe('Pancakes');
  });

  it('rejects non-UUID id', async () => {
    const api = createMockApi();
    await expect(runTool(getShoppingListTool, api, { id: 'nope' })).rejects.toThrow();
  });
});

describe('add_shopping_list_item', () => {
  it('adds item with note-only input', async () => {
    const api = createMockApi();
    api.addShoppingListItem.mockResolvedValue({
      id: UUID,
      quantity: 0,
      unit: null,
      food: null,
      note: 'Buy avocados',
      checked: false,
    });
    const result = await runTool(addShoppingListItemTool, api, {
      shoppingListId: UUID,
      note: 'Buy avocados',
    });
    expect(result.success).toBe(true);
    expect(result.item.note).toBe('Buy avocados');
  });
});

describe('update_shopping_list_item', () => {
  it('passes quantity/note/checked to api', async () => {
    const api = createMockApi();
    api.updateShoppingListItem.mockResolvedValue({
      id: UUID,
      quantity: 3,
      note: 'note',
      checked: true,
    });
    const result = await runTool(updateShoppingListItemTool, api, {
      itemId: UUID,
      quantity: 3,
      note: 'note',
      checked: true,
    });
    expect(api.updateShoppingListItem).toHaveBeenCalledWith(UUID, {
      quantity: 3,
      note: 'note',
      checked: true,
    });
    expect(result.item.checked).toBe(true);
  });
});

describe('delete_shopping_list_item', () => {
  it('deletes and confirms', async () => {
    const api = createMockApi();
    api.deleteShoppingListItem.mockResolvedValue(undefined);
    const result = await runTool(deleteShoppingListItemTool, api, { itemId: UUID });
    expect(api.deleteShoppingListItem).toHaveBeenCalledWith(UUID);
    expect(result.success).toBe(true);
  });
});

describe('add_recipe_to_shopping_list', () => {
  it('returns list summary with new item count', async () => {
    const api = createMockApi();
    api.addRecipeToShoppingList.mockResolvedValue({
      id: UUID,
      name: 'Weekly',
      listItems: [{}, {}, {}],
    });
    const result = await runTool(addRecipeToShoppingListTool, api, {
      shoppingListId: UUID,
      recipeId: UUID,
      recipeIncrementQuantity: 1,
    });
    expect(result.shoppingList.itemCount).toBe(3);
  });
});

// ============ Categories & tags ============

describe('list_categories', () => {
  it('forwards search term', async () => {
    const api = createMockApi();
    api.listCategories.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
      items: [],
    });
    await runTool(listCategoriesTool, api, { search: 'dinner' });
    expect(api.listCategories).toHaveBeenCalledWith(1, 50, 'dinner');
  });
});

describe('create_category', () => {
  it('returns created category', async () => {
    const api = createMockApi();
    api.createCategory.mockResolvedValue({ id: UUID, name: 'Dinner', slug: 'dinner' });
    const result = await runTool(createCategoryTool, api, { name: 'Dinner' });
    expect(result.category.slug).toBe('dinner');
  });
});

describe('list_tags', () => {
  it('forwards pagination', async () => {
    const api = createMockApi();
    api.listTags.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
      items: [],
    });
    await runTool(listTagsTool, api, {});
    expect(api.listTags).toHaveBeenCalledWith(1, 50, undefined);
  });
});

describe('create_tag', () => {
  it('returns created tag', async () => {
    const api = createMockApi();
    api.createTag.mockResolvedValue({ id: UUID, name: 'vegan', slug: 'vegan' });
    const result = await runTool(createTagTool, api, { name: 'vegan' });
    expect(result.tag.name).toBe('vegan');
  });
});

// ============ URL scraping ============

describe('test_scrape_url', () => {
  it('returns success:true on valid scrape', async () => {
    const api = createMockApi();
    api.testScrapeUrl.mockResolvedValue({ name: 'Scraped Recipe', ingredients: [] });
    const result = await runTool(testScrapeUrlTool, api, {
      url: 'https://example.com/recipe',
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe('URL scrape test completed successfully');
  });

  it('returns success:false when Mealie returns an error string', async () => {
    const api = createMockApi();
    api.testScrapeUrl.mockResolvedValue('recipe_scrapers was unable to scrape this URL');
    const result = await runTool(testScrapeUrlTool, api, {
      url: 'https://example.com/recipe',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('recipe_scrapers was unable to scrape');
    expect(result.message).toContain('create_recipe');
  });

  it('returns success:false for empty scrape response', async () => {
    const api = createMockApi();
    api.testScrapeUrl.mockResolvedValue(null);
    const result = await runTool(testScrapeUrlTool, api, {
      url: 'https://example.com/recipe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL input', async () => {
    const api = createMockApi();
    await expect(
      runTool(testScrapeUrlTool, api, { url: 'not a url' }),
    ).rejects.toThrow();
  });
});

describe('create_recipe_from_url', () => {
  it('returns slug on happy path', async () => {
    const api = createMockApi();
    api.createRecipeFromUrl.mockResolvedValue('pancakes');
    const result = await runTool(createRecipeFromUrlTool, api, {
      url: 'https://example.com/recipe',
    });
    expect(result.success).toBe(true);
    expect(result.slug).toBe('pancakes');
  });

  it('on Mealie 400 + unsupported scraper, returns structured failure with guidance', async () => {
    const api = createMockApi();
    api.createRecipeFromUrl.mockRejectedValue(
      new MealieApiError('API request failed: 400', 400, { detail: 'x' }),
    );
    api.testScrapeUrl.mockResolvedValue(
      'recipe_scrapers was unable to scrape this URL',
    );
    const result = await runTool(createRecipeFromUrlTool, api, {
      url: 'https://example.com/unsupported',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('scraper_unsupported_site');
    expect(result.message).toContain('Do NOT retry');
    expect(result.scraperOutput).toContain('unable to scrape');
  });

  it('on Mealie 400 but scraper probe also fails, returns generic rejection', async () => {
    const api = createMockApi();
    api.createRecipeFromUrl.mockRejectedValue(
      new MealieApiError('API request failed: 400', 400, null),
    );
    api.testScrapeUrl.mockRejectedValue(new Error('network'));
    const result = await runTool(createRecipeFromUrlTool, api, {
      url: 'https://example.com/bad',
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('mealie_rejected_url');
    expect(result.scraperOutput).toBeNull();
  });

  it('rethrows non-400 errors', async () => {
    const api = createMockApi();
    api.createRecipeFromUrl.mockRejectedValue(
      new MealieApiError('API request failed: 500', 500, null),
    );
    await expect(
      runTool(createRecipeFromUrlTool, api, { url: 'https://example.com/recipe' }),
    ).rejects.toThrow(MealieApiError);
  });
});

// ============ Meal planning ============

describe('list_meal_plans', () => {
  it('forwards start/end dates', async () => {
    const api = createMockApi();
    api.listMealPlans.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
      items: [],
    });
    await runTool(listMealPlansTool, api, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    expect(api.listMealPlans).toHaveBeenCalledWith('2026-04-01', '2026-04-30');
  });

  it('returns flattened entries with recipe info', async () => {
    const api = createMockApi();
    api.listMealPlans.mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [
        {
          id: 42,
          date: '2026-04-19',
          entryType: 'dinner',
          title: '',
          text: '',
          recipeId: UUID,
          recipe: { name: 'Pancakes', slug: 'pancakes' },
        },
      ],
    });
    const result = await runTool(listMealPlansTool, api, {});
    expect(result.mealPlans[0].recipeName).toBe('Pancakes');
  });
});

describe('get_todays_meal_plan', () => {
  it("returns today's date and entries", async () => {
    const api = createMockApi();
    api.getTodaysMealPlan.mockResolvedValue([
      {
        id: 1,
        entryType: 'breakfast',
        title: '',
        text: '',
        recipeId: UUID,
        recipe: { name: 'Pancakes', slug: 'pancakes' },
      },
    ]);
    const result = await runTool(getTodaysMealPlanTool, api, {});
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.meals[0].recipeName).toBe('Pancakes');
  });
});

describe('create_meal_plan', () => {
  it('creates entry with entryType', async () => {
    const api = createMockApi();
    api.createMealPlan.mockResolvedValue({
      id: 7,
      date: '2026-04-19',
      entryType: 'dinner',
      title: '',
      text: '',
      recipeId: UUID,
    });
    const result = await runTool(createMealPlanTool, api, {
      date: '2026-04-19',
      entryType: 'dinner',
      recipeId: UUID,
    });
    expect(result.success).toBe(true);
    expect(result.mealPlan.id).toBe(7);
  });
});

describe('delete_meal_plan', () => {
  it('deletes by numeric id', async () => {
    const api = createMockApi();
    api.deleteMealPlan.mockResolvedValue(undefined);
    const result = await runTool(deleteMealPlanTool, api, { itemId: 42 });
    expect(api.deleteMealPlan).toHaveBeenCalledWith(42);
    expect(result.success).toBe(true);
  });
});

// ============ User ============

describe('get_current_user', () => {
  it('returns structured user/group/household', async () => {
    const api = createMockApi();
    api.getCurrentUser.mockResolvedValue({
      id: UUID,
      username: 'cory',
      fullName: 'Cory Logan',
      email: 'cory@example.com',
      admin: true,
      group: 'Home',
      groupId: 'g1',
      groupSlug: 'home',
      household: 'Family',
      householdId: 'h1',
      householdSlug: 'family',
    });
    const result = await runTool(getCurrentUserTool, api, {});
    expect(result.user.username).toBe('cory');
    expect(result.group.slug).toBe('home');
    expect(result.household.slug).toBe('family');
  });
});
