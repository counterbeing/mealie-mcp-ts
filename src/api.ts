import { z } from 'zod';
import type { Config } from './config.js';
import {
  type AddRecipeToListInput,
  type CategoryOut,
  type CategoryPagination,
  type CreateMealPlanInput,
  type CreateRecipeInput,
  type CurrentUser,
  categoryOutSchema,
  categoryPaginationSchema,
  currentUserSchema,
  type FoodPagination,
  foodPaginationSchema,
  type IngredientFood,
  ingredientFoodSchema,
  type MealPlanEntry,
  type MealPlanPagination,
  mealPlanEntrySchema,
  mealPlanPaginationSchema,
  type Recipe,
  type RecipePagination,
  recipePaginationSchema,
  recipeSchema,
  type ShoppingList,
  type ShoppingListItem,
  type ShoppingListItemInput,
  type ShoppingListPagination,
  shoppingListItemSchema,
  shoppingListPaginationSchema,
  shoppingListSchema,
  type TagOut,
  type TagPagination,
  tagOutSchema,
  tagPaginationSchema,
  type UpdateRecipeInput,
} from './types.js';

// Response type from the ingredient parser
interface ParsedIngredient {
  quantity: number | null;
  unit: {
    id: string;
    name: string;
    pluralName?: string;
    description?: string;
    abbreviation?: string;
    fraction?: boolean;
    useAbbreviation?: boolean;
  } | null;
  food: {
    id: string;
    name: string;
    pluralName?: string;
    description?: string;
    labelId?: string;
  } | null;
  note: string | null;
  display: string;
  originalText: string | null;
  referenceId: string;
}

interface ParsedIngredientResponse {
  ingredient: ParsedIngredient;
}

export class MealieApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'MealieApiError';
  }
}

export class MealieApi {
  private baseUrl: string;
  private apiKey: string;
  private groupSlug: string | null = null;

  constructor(config: Config) {
    this.baseUrl = config.mealieUrl;
    this.apiKey = config.mealieApiKey;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getGroupSlug(): Promise<string> {
    if (!this.groupSlug) {
      const user = await this.getCurrentUser();
      this.groupSlug = user.groupSlug;
    }
    return this.groupSlug;
  }

  buildRecipeUrl(slug: string): string {
    // Use cached group slug or fall back to 'home'
    const groupSlug = this.groupSlug || 'home';
    return `${this.baseUrl}/g/${groupSlug}/r/${slug}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new MealieApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorBody,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ============ Ingredient Parser ============

  async parseIngredient(ingredientText: string): Promise<ParsedIngredient> {
    const data = await this.request<ParsedIngredientResponse>(
      '/api/parser/ingredient',
      {
        method: 'POST',
        body: JSON.stringify({ ingredient: ingredientText }),
      },
    );
    return data.ingredient;
  }

  async parseIngredients(
    ingredients: CreateRecipeInput['recipeIngredient'],
  ): Promise<unknown[]> {
    if (!ingredients) return [];

    const parsed: unknown[] = [];
    let pendingTitle: string | null = null;

    for (const ing of ingredients) {
      // Check if this is a section header (title only, no ingredient data)
      if (ing.title && !ing.originalText && !ing.food && !ing.quantity) {
        // Save the title to apply to the next ingredient
        pendingTitle = ing.title;
        continue;
      }

      // If originalText is provided, parse it
      if (ing.originalText) {
        const parsedIng = await this.parseIngredient(ing.originalText);

        // Create unit if it doesn't exist
        let unit = parsedIng.unit;
        if (unit && !unit.id && unit.name) {
          try {
            const created = await this.createUnit(unit.name);
            unit = { ...unit, id: created.id };
          } catch {
            // Unit creation failed (might already exist), keep as null
            unit = null;
          }
        }

        // Create food if it doesn't exist
        let food = parsedIng.food;
        if (food && !food.id && food.name) {
          try {
            const created = await this.createFood(food.name);
            if (created.id) {
              food = { ...food, id: created.id };
            }
          } catch {
            // Food creation failed (might already exist), keep as null
            food = null;
          }
        }

        const cleanedIng = {
          ...parsedIng,
          unit: unit?.id ? unit : null,
          food: food?.id ? food : null,
          note: parsedIng.note || '',
          // Apply pending section title to first ingredient of section
          title: pendingTitle || '',
        };
        parsed.push(cleanedIng);
        pendingTitle = null;
      } else {
        // Otherwise, keep as-is (structured ingredient)
        // Apply pending section title if present
        const ingWithTitle = pendingTitle
          ? { ...ing, title: pendingTitle }
          : ing;
        parsed.push(ingWithTitle);
        pendingTitle = null;
      }
    }
    return parsed;
  }

  // ============ Recipes ============

  async listRecipes(page = 1, perPage = 50): Promise<RecipePagination> {
    const data = await this.request<unknown>(
      `/api/recipes?page=${page}&perPage=${perPage}`,
    );
    return recipePaginationSchema.parse(data);
  }

  async getRecipe(slug: string): Promise<Recipe> {
    const data = await this.request<unknown>(`/api/recipes/${slug}`);
    return recipeSchema.parse(data);
  }

  async createRecipe(input: CreateRecipeInput): Promise<string> {
    // First create the recipe with just the name
    const createResponse = await this.request<{ slug: string }>(
      '/api/recipes',
      {
        method: 'POST',
        body: JSON.stringify({ name: input.name }),
      },
    );

    const slug = createResponse.slug || createResponse;

    // If there are additional fields, update the recipe
    if (
      input.description ||
      input.recipeYield ||
      input.totalTime ||
      input.prepTime ||
      input.cookTime ||
      input.recipeIngredient ||
      input.recipeInstructions
    ) {
      await this.updateRecipe({
        ...input,
        slug: typeof slug === 'string' ? slug : String(slug),
      });
    }

    return typeof slug === 'string' ? slug : String(slug);
  }

  async updateRecipe(input: UpdateRecipeInput): Promise<Recipe> {
    // First get the current recipe to merge with updates
    const current = await this.getRecipe(input.slug);

    // Parse ingredients if provided (handles originalText automatically)
    let ingredients: unknown[] = current.recipeIngredient;
    if (input.recipeIngredient) {
      ingredients = await this.parseIngredients(input.recipeIngredient);
    }

    const updateData = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      recipeYield: input.recipeYield ?? current.recipeYield,
      totalTime: input.totalTime ?? current.totalTime,
      prepTime: input.prepTime ?? current.prepTime,
      cookTime: input.cookTime ?? current.cookTime,
      recipeIngredient: ingredients,
      recipeInstructions:
        input.recipeInstructions ?? current.recipeInstructions,
    };

    const data = await this.request<unknown>(`/api/recipes/${input.slug}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
    return recipeSchema.parse(data);
  }

  async deleteRecipe(slug: string): Promise<void> {
    await this.request<void>(`/api/recipes/${slug}`, {
      method: 'DELETE',
    });
  }

  async uploadRecipeImage(
    slug: string,
    imageBase64: string,
    fileName = 'image.jpg',
  ): Promise<void> {
    // Decode base64 and create form data
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Determine content type from file extension or default to jpeg
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = contentTypeMap[ext] || 'image/jpeg';

    // Create a Blob from the buffer
    const blob = new Blob([imageBuffer], { type: contentType });

    // Create FormData
    const formData = new FormData();
    formData.append('image', blob, fileName);
    formData.append('extension', ext);

    const url = `${this.baseUrl}/api/recipes/${slug}/image`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new MealieApiError(
        `Failed to upload image: ${response.status} ${response.statusText}`,
        response.status,
        errorBody,
      );
    }
  }

  // ============ Units ============

  async createUnit(name: string): Promise<{ id: string; name: string }> {
    const data = await this.request<{ id: string; name: string }>(
      '/api/units',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    );
    return data;
  }

  // ============ Foods ============

  async listFoods(
    page = 1,
    perPage = 50,
    search?: string,
  ): Promise<FoodPagination> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const data = await this.request<unknown>(
      `/api/foods?page=${page}&perPage=${perPage}${searchParam}`,
    );
    return foodPaginationSchema.parse(data);
  }

  async createFood(
    name: string,
    pluralName?: string,
    description?: string,
  ): Promise<IngredientFood> {
    const data = await this.request<unknown>('/api/foods', {
      method: 'POST',
      body: JSON.stringify({
        name,
        pluralName: pluralName ?? null,
        description: description ?? '',
      }),
    });
    return ingredientFoodSchema.parse(data);
  }

  // ============ Shopping Lists ============

  async listShoppingLists(
    page = 1,
    perPage = 50,
  ): Promise<ShoppingListPagination> {
    const data = await this.request<unknown>(
      `/api/households/shopping/lists?page=${page}&perPage=${perPage}`,
    );
    return shoppingListPaginationSchema.parse(data);
  }

  async getShoppingList(id: string): Promise<ShoppingList> {
    const data = await this.request<unknown>(
      `/api/households/shopping/lists/${id}`,
    );
    return shoppingListSchema.parse(data);
  }

  async addShoppingListItem(
    input: ShoppingListItemInput,
  ): Promise<ShoppingListItem> {
    const data = await this.request<unknown>('/api/households/shopping/items', {
      method: 'POST',
      body: JSON.stringify({
        shoppingListId: input.shoppingListId,
        note: input.note ?? '',
        display: input.note ?? '',
        quantity: input.quantity ?? 1,
        unit: input.unit ?? null,
        food: input.food ?? null,
        checked: input.checked ?? false,
      }),
    });
    return shoppingListItemSchema.parse(data);
  }

  // ============ Categories ============

  async listCategories(
    page = 1,
    perPage = 50,
    search?: string,
  ): Promise<CategoryPagination> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const data = await this.request<unknown>(
      `/api/organizers/categories?page=${page}&perPage=${perPage}${searchParam}`,
    );
    return categoryPaginationSchema.parse(data);
  }

  async createCategory(name: string): Promise<CategoryOut> {
    const data = await this.request<unknown>('/api/organizers/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return categoryOutSchema.parse(data);
  }

  // ============ Tags ============

  async listTags(
    page = 1,
    perPage = 50,
    search?: string,
  ): Promise<TagPagination> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const data = await this.request<unknown>(
      `/api/organizers/tags?page=${page}&perPage=${perPage}${searchParam}`,
    );
    return tagPaginationSchema.parse(data);
  }

  async createTag(name: string): Promise<TagOut> {
    const data = await this.request<unknown>('/api/organizers/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return tagOutSchema.parse(data);
  }

  // ============ Recipe URL Scraping ============

  async testScrapeUrl(url: string): Promise<unknown> {
    const data = await this.request<unknown>('/api/recipes/test-scrape-url', {
      method: 'POST',
      body: JSON.stringify({ url, useOpenAI: false }),
    });
    return data;
  }

  async createRecipeFromUrl(url: string, includeTags = false): Promise<string> {
    const data = await this.request<string>('/api/recipes/create/url', {
      method: 'POST',
      body: JSON.stringify({ url, includeTags }),
    });
    return data; // Returns the slug of the created recipe
  }

  // ============ Meal Plans ============

  async listMealPlans(
    startDate?: string,
    endDate?: string,
  ): Promise<MealPlanPagination> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const queryString = params.toString();
    const data = await this.request<unknown>(
      `/api/households/mealplans${queryString ? `?${queryString}` : ''}`,
    );
    return mealPlanPaginationSchema.parse(data);
  }

  async getTodaysMealPlan(): Promise<MealPlanEntry[]> {
    const data = await this.request<unknown[]>(
      '/api/households/mealplans/today',
    );
    return z.array(mealPlanEntrySchema).parse(data);
  }

  async createMealPlan(input: CreateMealPlanInput): Promise<MealPlanEntry> {
    const data = await this.request<unknown>('/api/households/mealplans', {
      method: 'POST',
      body: JSON.stringify({
        date: input.date,
        entryType: input.entryType,
        title: input.title,
        text: input.text,
        recipeId: input.recipeId ?? null,
      }),
    });
    return mealPlanEntrySchema.parse(data);
  }

  async deleteMealPlan(itemId: number): Promise<void> {
    await this.request<void>(`/api/households/mealplans/${itemId}`, {
      method: 'DELETE',
    });
  }

  // ============ Shopping List Items (Extended) ============

  async updateShoppingListItem(
    itemId: string,
    updates: Partial<{ quantity: number; note: string; checked: boolean }>,
  ): Promise<ShoppingListItem> {
    // First get the current item to merge with updates
    const currentItem = await this.request<ShoppingListItem>(
      `/api/households/shopping/items/${itemId}`,
    );

    const updateData = {
      ...currentItem,
      quantity: updates.quantity ?? currentItem.quantity,
      note: updates.note ?? currentItem.note,
      display: updates.note ?? currentItem.display,
      checked: updates.checked ?? currentItem.checked,
    };

    const data = await this.request<unknown>(
      `/api/households/shopping/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      },
    );
    // Response is ShoppingListItemsCollectionOut with updatedItems array
    const collection = data as { updatedItems: unknown[] };
    return shoppingListItemSchema.parse(collection.updatedItems[0]);
  }

  async deleteShoppingListItem(itemId: string): Promise<void> {
    await this.request<void>(`/api/households/shopping/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async addRecipeToShoppingList(
    input: AddRecipeToListInput,
  ): Promise<ShoppingList> {
    const data = await this.request<unknown>(
      `/api/households/shopping/lists/${input.shoppingListId}/recipe/${input.recipeId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          recipeIncrementQuantity: input.recipeQuantity,
          recipeIngredients: null,
        }),
      },
    );
    return shoppingListSchema.parse(data);
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const data = await this.request<unknown>('/api/users/self');
    return currentUserSchema.parse(data);
  }
}
