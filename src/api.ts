import { z } from 'zod';
import type { Config } from './config.js';
import { logError, logInfo } from './logger.js';
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

// Realistic desktop Chrome UA — sites commonly block Python/scraper UAs
// (e.g. AllRecipes returns 403 to Mealie's recipe_scrapers default).
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BROWSER_ACCEPT_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPageAsBrowser(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: BROWSER_ACCEPT_HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface ExtractedRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  recipeYield?: string;
  totalTime?: string;
  prepTime?: string;
  cookTime?: string;
  imageUrl?: string;
}

function parseIsoDuration(iso: unknown): string | undefined {
  if (!iso || typeof iso !== 'string') return undefined;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return undefined;
  const hours = Number.parseInt(m[1] ?? '0', 10);
  const mins = Number.parseInt(m[2] ?? '0', 10);
  const total = hours * 60 + mins;
  return total > 0 ? `${total} minutes` : undefined;
}

function extractImageUrl(img: unknown): string | undefined {
  if (!img) return undefined;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    for (const item of img) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof img === 'object') {
    const obj = img as Record<string, unknown>;
    if (typeof obj.url === 'string') return obj.url;
    if (typeof obj['@id'] === 'string') return obj['@id'] as string;
  }
  return undefined;
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Record<string, unknown>;
  const t = obj['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.includes('Recipe')) return obj;
  if (obj['@graph']) return findRecipeNode(obj['@graph']);
  return null;
}

// Extract a schema.org Recipe from any JSON-LD blocks in the HTML. Handles the
// common case where a site has valid structured data but Mealie's
// recipe_scrapers refuses because the domain isn't whitelisted.
function extractRecipeFromJsonLd(html: string): ExtractedRecipe | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    const jsonStr = (match[1] ?? '').trim();
    if (!jsonStr) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      continue;
    }
    const recipe = findRecipeNode(parsed);
    if (!recipe) continue;

    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter((i): i is string => typeof i === 'string')
      : [];

    const instructions: string[] = [];
    const rawInstructions = recipe.recipeInstructions;
    if (Array.isArray(rawInstructions)) {
      for (const step of rawInstructions) {
        if (typeof step === 'string') {
          instructions.push(step);
        } else if (step && typeof step === 'object') {
          const s = step as Record<string, unknown>;
          if (typeof s.text === 'string') instructions.push(s.text);
          else if (typeof s.name === 'string') instructions.push(s.name);
          // ignore nested HowToSection / etc. for now
        }
      }
    } else if (typeof rawInstructions === 'string') {
      // Split on newlines as a best-effort
      for (const line of rawInstructions.split(/\n+/)) {
        const trimmed = line.trim();
        if (trimmed) instructions.push(trimmed);
      }
    }

    if (!recipe.name || !ingredients.length) continue;

    return {
      name: String(recipe.name),
      description:
        typeof recipe.description === 'string' ? recipe.description : undefined,
      ingredients,
      instructions,
      recipeYield:
        recipe.recipeYield != null ? String(recipe.recipeYield) : undefined,
      totalTime: parseIsoDuration(recipe.totalTime),
      prepTime: parseIsoDuration(recipe.prepTime),
      cookTime: parseIsoDuration(recipe.cookTime),
      imageUrl: extractImageUrl(recipe.image),
    };
  }
  return null;
}

async function fetchFromWayback(url: string): Promise<string | null> {
  try {
    const availRes = await fetchWithTimeout(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { headers: BROWSER_ACCEPT_HEADERS },
    );
    if (!availRes.ok) return null;
    const avail = (await availRes.json()) as {
      archived_snapshots?: { closest?: { url: string; status: string } };
    };
    const snapshotUrl = avail.archived_snapshots?.closest?.url;
    if (!snapshotUrl) return null;
    // /id_/ flag serves the original archived content without Wayback's frame injection
    const rawUrl = snapshotUrl.replace(/\/web\/(\d+)\//, '/web/$1id_/');
    const pageRes = await fetchWithTimeout(rawUrl, {
      headers: BROWSER_ACCEPT_HEADERS,
    });
    if (!pageRes.ok) return null;
    return await pageRes.text();
  } catch {
    return null;
  }
}

// Case-insensitive match that also tolerates simple English plural differences:
// exact match, candidate+s, candidate+es, target+s, target+es. Intentionally
// conservative — we'd rather miss a dedupe than falsely merge "glass" with "gla".
function matchesNameVariant(candidate: string, target: string): boolean {
  const c = candidate.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!c || !t) return false;
  if (c === t) return true;
  if (`${c}s` === t || `${c}es` === t) return true;
  if (c === `${t}s` || c === `${t}es`) return true;
  return false;
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

    for (const ing of ingredients) {
      const sectionTitle = ing.title?.trim() || '';
      const hasIngredientData =
        Boolean(ing.originalText) ||
        Boolean(ing.food) ||
        Boolean(ing.unit) ||
        ing.quantity != null ||
        Boolean(ing.note);

      // Preserve recipe section headers as standalone title-only rows so Mealie
      // can render and round-trip the grouping correctly.
      if (sectionTitle && !hasIngredientData) {
        parsed.push({ title: sectionTitle });
        continue;
      }

      // If an ingredient row also carries a section title, emit the header row
      // first and keep the ingredient itself title-free.
      if (sectionTitle) {
        parsed.push({ title: sectionTitle });
      }

      // Normalize structured-with-name-only ingredients into originalText so
      // the parser path can resolve/create missing unit+food IDs. Without this,
      // Mealie 500s with ValueError when it sees {name: "flank steak"} refs
      // that don't map to existing records.
      let textToParse = ing.originalText;
      if (!textToParse && (ing.unit?.name || ing.food?.name)) {
        textToParse = [
          ing.quantity != null ? String(ing.quantity) : '',
          ing.unit?.name ?? '',
          ing.food?.name ?? '',
          ing.note ?? '',
        ]
          .filter((part) => part.trim() !== '')
          .join(' ')
          .trim();
      }

      if (textToParse) {
        const parsedIng = await this.parseIngredient(textToParse);

        // Resolve-or-create: look up existing unit/food by name (incl. simple
        // plural variants) before creating. Prevents dup records from
        // accumulating across recipes.
        let unit = parsedIng.unit;
        if (unit && !unit.id && unit.name) {
          const resolved = await this.resolveOrCreateUnit(unit.name);
          unit = resolved ? { ...unit, id: resolved.id, name: resolved.name } : null;
        }

        let food = parsedIng.food;
        if (food && !food.id && food.name) {
          const resolved = await this.resolveOrCreateFood(food.name);
          food = resolved?.id
            ? { ...food, id: resolved.id, name: resolved.name }
            : null;
        }

        parsed.push({
          ...parsedIng,
          unit: unit?.id ? unit : null,
          food: food?.id ? food : null,
          note: parsedIng.note || '',
          title: '',
        });
      } else {
        // Note-only or otherwise trivially-structured ingredient — pass through
        parsed.push({ ...ing, title: '' });
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

  async listUnits(
    page = 1,
    perPage = 100,
    search?: string,
  ): Promise<{ items: Array<{ id: string; name: string; pluralName?: string | null }> }> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const data = await this.request<{
      items: Array<{ id: string; name: string; pluralName?: string | null }>;
    }>(`/api/units?page=${page}&perPage=${perPage}${searchParam}`);
    return data;
  }

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

  async resolveOrCreateUnit(
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const page = await this.listUnits(1, 50, trimmed);
      const match = page.items.find((u) =>
        matchesNameVariant(u.name, trimmed) ||
        (u.pluralName ? matchesNameVariant(u.pluralName, trimmed) : false),
      );
      if (match) return { id: match.id, name: match.name };
      return await this.createUnit(trimmed);
    } catch {
      return null;
    }
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

  async resolveOrCreateFood(name: string): Promise<IngredientFood | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const page = await this.listFoods(1, 50, trimmed);
      const match = page.items.find((f) =>
        matchesNameVariant(f.name, trimmed) ||
        (f.pluralName ? matchesNameVariant(f.pluralName, trimmed) : false),
      );
      if (match) return match;
      return await this.createFood(trimmed);
    } catch {
      return null;
    }
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
    const tried: string[] = [];

    // 1. Mealie's native scraper — fastest path when it works.
    try {
      const slug = await this.request<string>('/api/recipes/create/url', {
        method: 'POST',
        body: JSON.stringify({ url, includeTags }),
      });
      logInfo('url_import.native_ok', { url });
      return slug;
    } catch (err) {
      if (!(err instanceof MealieApiError) || err.statusCode !== 400) {
        throw err;
      }
      tried.push('native');
      logInfo('url_import.native_failed', { url, status: err.statusCode });
    }

    // 2. Fetch the page with a realistic browser UA, then let Mealie parse the
    //    HTML. Defeats scraper-UA blocks (AllRecipes, etc.).
    const directHtml = await fetchPageAsBrowser(url);
    if (directHtml) {
      try {
        const slug = await this.postHtmlToMealie(url, directHtml, includeTags);
        logInfo('url_import.direct_html_ok', { url, bytes: directHtml.length });
        return slug;
      } catch (err) {
        tried.push('direct+mealie_html');
        logInfo('url_import.direct_html_rejected', {
          url,
          bytes: directHtml.length,
          err: err instanceof Error ? err.message : 'unknown',
        });
      }

      // 2b. If Mealie's scraper still refused (site not in recipe_scrapers
      //     whitelist), extract schema.org JSON-LD ourselves.
      const extracted = extractRecipeFromJsonLd(directHtml);
      if (extracted) {
        try {
          const slug = await this.createRecipeFromExtracted(extracted, url);
          logInfo('url_import.json_ld_ok', {
            url,
            ingredients: extracted.ingredients.length,
          });
          return slug;
        } catch (err) {
          tried.push('direct+json_ld');
          logError('url_import.json_ld_failed', {
            url,
            err: err instanceof Error ? err.message : 'unknown',
          });
        }
      } else {
        tried.push('direct+no_json_ld');
      }
    } else {
      tried.push('direct_blocked');
    }

    // 3. Last resort: Wayback Machine. Same cascade on the archived HTML.
    const waybackHtml = await fetchFromWayback(url);
    if (waybackHtml) {
      try {
        const slug = await this.postHtmlToMealie(url, waybackHtml, includeTags);
        logInfo('url_import.wayback_html_ok', { url, bytes: waybackHtml.length });
        return slug;
      } catch {
        tried.push('wayback+mealie_html');
      }
      const extracted = extractRecipeFromJsonLd(waybackHtml);
      if (extracted) {
        try {
          const slug = await this.createRecipeFromExtracted(extracted, url);
          logInfo('url_import.wayback_json_ld_ok', { url });
          return slug;
        } catch {
          tried.push('wayback+json_ld');
        }
      }
    } else {
      tried.push('wayback_unavailable');
    }

    logError('url_import.all_failed', { url, tried: tried.join(',') });
    throw new MealieApiError(
      `Could not import recipe from URL — all strategies failed: ${tried.join(', ')}`,
      400,
      { url, tried },
    );
  }

  private async postHtmlToMealie(
    url: string,
    html: string,
    includeTags: boolean,
  ): Promise<string> {
    return this.request<string>('/api/recipes/create/html-or-json', {
      method: 'POST',
      body: JSON.stringify({
        data: html,
        url,
        includeTags,
        includeCategories: false,
      }),
    });
  }

  // Import a recipe from raw HTML the caller already fetched. Runs the same
  // Mealie /html-or-json → JSON-LD fallback cascade used by createRecipeFromUrl.
  // Useful when the caller (e.g. Hermes with its browser tool) can reach a site
  // that the MCP's own fetch can't.
  async createRecipeFromHtml(
    html: string,
    sourceUrl: string | undefined,
    includeTags = false,
  ): Promise<string> {
    const refUrl = sourceUrl ?? 'about:blank';
    const tried: string[] = [];

    try {
      const slug = await this.postHtmlToMealie(refUrl, html, includeTags);
      logInfo('html_import.mealie_ok', { url: refUrl, bytes: html.length });
      return slug;
    } catch (err) {
      tried.push('mealie_html');
      logInfo('html_import.mealie_rejected', {
        url: refUrl,
        err: err instanceof Error ? err.message : 'unknown',
      });
    }

    const extracted = extractRecipeFromJsonLd(html);
    if (extracted) {
      try {
        const slug = await this.createRecipeFromExtracted(extracted, refUrl);
        logInfo('html_import.json_ld_ok', {
          url: refUrl,
          ingredients: extracted.ingredients.length,
        });
        return slug;
      } catch (err) {
        tried.push('json_ld');
        logError('html_import.json_ld_failed', {
          url: refUrl,
          err: err instanceof Error ? err.message : 'unknown',
        });
      }
    } else {
      tried.push('no_json_ld_found');
    }

    throw new MealieApiError(
      `Could not create recipe from provided HTML — tried: ${tried.join(', ')}`,
      400,
      { sourceUrl, tried },
    );
  }

  // Create a recipe from our own JSON-LD extraction. Uses the standard
  // create_recipe flow so originalText strings get parsed + deduped.
  private async createRecipeFromExtracted(
    extracted: ExtractedRecipe,
    sourceUrl: string,
  ): Promise<string> {
    const slug = await this.createRecipe({
      name: extracted.name,
      description: extracted.description,
      recipeYield: extracted.recipeYield,
      totalTime: extracted.totalTime,
      prepTime: extracted.prepTime,
      cookTime: extracted.cookTime,
      recipeIngredient: extracted.ingredients.map((text) => ({ originalText: text })),
      recipeInstructions: extracted.instructions.map((text) => ({ text })),
    });

    // Best-effort image download + upload. Don't fail the whole import if
    // image fetch fails.
    if (extracted.imageUrl) {
      try {
        const imgRes = await fetchWithTimeout(extracted.imageUrl, {
          headers: BROWSER_ACCEPT_HEADERS,
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const base64 = buf.toString('base64');
          const ext = (extracted.imageUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)?.[1] ?? 'jpg').toLowerCase();
          await this.uploadRecipeImage(slug, base64, `image.${ext}`);
        }
      } catch (err) {
        logInfo('url_import.image_upload_failed', {
          url: sourceUrl,
          err: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return slug;
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
