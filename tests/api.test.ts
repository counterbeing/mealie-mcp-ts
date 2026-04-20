import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MealieApi } from '../src/api.js';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const FOOD_ID = '22222222-2222-4222-8222-222222222222';

function makeApi(): MealieApi {
  return new MealieApi({
    mealieUrl: 'http://mealie.test',
    mealieApiKey: 'test',
    enabledTools: [],
    transport: 'stdio',
    port: 3000,
    allowedHosts: ['localhost'],
  });
}

describe('parseIngredients', () => {
  let api: MealieApi;

  beforeEach(() => {
    api = makeApi();
  });

  it('returns [] for undefined input', async () => {
    expect(await api.parseIngredients(undefined)).toEqual([]);
  });

  it('parses originalText and attaches resolved unit/food IDs', async () => {
    vi.spyOn(api, 'parseIngredient').mockResolvedValue({
      quantity: 2,
      unit: { id: '', name: 'cup' },
      food: { id: '', name: 'flour' },
      note: '',
      display: '2 cup flour',
      originalText: '2 cups flour',
      referenceId: 'r1',
    } as never);
    vi.spyOn(api, 'resolveOrCreateUnit').mockResolvedValue({
      id: UNIT_ID,
      name: 'cup',
    });
    vi.spyOn(api, 'resolveOrCreateFood').mockResolvedValue({
      id: FOOD_ID,
      name: 'flour',
    } as never);

    const result = (await api.parseIngredients([
      { originalText: '2 cups flour' },
    ])) as Array<{
      unit: { id: string; name: string } | null;
      food: { id: string; name: string } | null;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0].unit?.id).toBe(UNIT_ID);
    expect(result[0].food?.id).toBe(FOOD_ID);
  });

  it('normalizes structured {unit:{name},food:{name}} through the parser', async () => {
    const parseSpy = vi.spyOn(api, 'parseIngredient').mockResolvedValue({
      quantity: 1,
      unit: { id: '', name: 'lb' },
      food: { id: '', name: 'flank steak' },
      note: 'thinly sliced',
      display: '1 lb flank steak thinly sliced',
      originalText: '1 lb flank steak thinly sliced',
      referenceId: 'r1',
    } as never);
    vi.spyOn(api, 'resolveOrCreateUnit').mockResolvedValue({
      id: UNIT_ID,
      name: 'pound',
    });
    vi.spyOn(api, 'resolveOrCreateFood').mockResolvedValue({
      id: FOOD_ID,
      name: 'flank steak',
    } as never);

    const result = (await api.parseIngredients([
      {
        quantity: 1,
        unit: { name: 'lb' },
        food: { name: 'flank steak' },
        note: 'thinly sliced',
      },
    ])) as Array<{
      unit: { id: string } | null;
      food: { id: string } | null;
    }>;

    expect(parseSpy).toHaveBeenCalledWith('1 lb flank steak thinly sliced');
    expect(result[0].unit?.id).toBe(UNIT_ID);
    expect(result[0].food?.id).toBe(FOOD_ID);
  });

  it('attaches a section title from a standalone header entry to the next ingredient', async () => {
    vi.spyOn(api, 'parseIngredient').mockResolvedValue({
      quantity: 1,
      unit: { id: UNIT_ID, name: 'cup' },
      food: { id: FOOD_ID, name: 'flour' },
      note: '',
      display: '1 cup flour',
      originalText: '1 cup flour',
      referenceId: 'r1',
    } as never);

    const result = (await api.parseIngredients([
      { title: 'Dry Ingredients' },
      { originalText: '1 cup flour' },
    ])) as Array<{ title: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Dry Ingredients');
  });

  it('passes note-only ingredients through without calling the parser', async () => {
    const parseSpy = vi.spyOn(api, 'parseIngredient');

    const result = (await api.parseIngredients([
      { note: 'Salt to taste' },
    ])) as Array<{ note: string }>;

    expect(parseSpy).not.toHaveBeenCalled();
    expect(result[0].note).toBe('Salt to taste');
  });

  it('nulls out unit when resolver returns null', async () => {
    vi.spyOn(api, 'parseIngredient').mockResolvedValue({
      quantity: 1,
      unit: { id: '', name: 'weirdunit' },
      food: { id: FOOD_ID, name: 'flour' },
      note: '',
      display: '1 weirdunit flour',
      originalText: '1 weirdunit flour',
      referenceId: 'r1',
    } as never);
    vi.spyOn(api, 'resolveOrCreateUnit').mockResolvedValue(null);

    const result = (await api.parseIngredients([
      { originalText: '1 weirdunit flour' },
    ])) as Array<{ unit: unknown }>;

    expect(result[0].unit).toBeNull();
  });
});

describe('resolveOrCreateFood', () => {
  let api: MealieApi;

  beforeEach(() => {
    api = makeApi();
  });

  it('returns existing food on exact name match (case-insensitive)', async () => {
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [{ id: FOOD_ID, name: 'Flank Steak', pluralName: null }],
    } as never);
    const createSpy = vi.spyOn(api, 'createFood');

    const result = await api.resolveOrCreateFood('flank steak');

    expect(result?.id).toBe(FOOD_ID);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('matches plural variant (target+s) against existing singular', async () => {
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [{ id: FOOD_ID, name: 'onion', pluralName: null }],
    } as never);
    const createSpy = vi.spyOn(api, 'createFood');

    const result = await api.resolveOrCreateFood('onions');

    expect(result?.id).toBe(FOOD_ID);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('matches es-plural variant against existing singular', async () => {
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [{ id: FOOD_ID, name: 'tomato', pluralName: null }],
    } as never);

    const result = await api.resolveOrCreateFood('tomatoes');

    expect(result?.id).toBe(FOOD_ID);
  });

  it('matches against existing pluralName when lookup uses singular', async () => {
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [
        { id: FOOD_ID, name: 'flank steak', pluralName: 'flank steaks' },
      ],
    } as never);

    const result = await api.resolveOrCreateFood('flank steaks');

    expect(result?.id).toBe(FOOD_ID);
  });

  it('creates a new food when no match is found', async () => {
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
      items: [],
    } as never);
    const createSpy = vi
      .spyOn(api, 'createFood')
      .mockResolvedValue({ id: FOOD_ID, name: 'gochujang' } as never);

    const result = await api.resolveOrCreateFood('gochujang');

    expect(createSpy).toHaveBeenCalledWith('gochujang');
    expect(result?.id).toBe(FOOD_ID);
  });

  it('does not falsely merge short-name collisions (glass !== gla)', async () => {
    // If Mealie search returns "gla" for the query "glass", we should still
    // create "glass" rather than merge into "gla".
    vi.spyOn(api, 'listFoods').mockResolvedValue({
      page: 1,
      per_page: 50,
      total: 1,
      total_pages: 1,
      items: [{ id: 'other', name: 'gla', pluralName: null }],
    } as never);
    const createSpy = vi
      .spyOn(api, 'createFood')
      .mockResolvedValue({ id: FOOD_ID, name: 'glass' } as never);

    const result = await api.resolveOrCreateFood('glass');

    expect(createSpy).toHaveBeenCalledWith('glass');
    expect(result?.id).toBe(FOOD_ID);
  });

  it('returns null on empty input', async () => {
    expect(await api.resolveOrCreateFood('   ')).toBeNull();
  });

  it('returns null if both list and create fail', async () => {
    vi.spyOn(api, 'listFoods').mockRejectedValue(new Error('500'));

    expect(await api.resolveOrCreateFood('anything')).toBeNull();
  });
});

describe('createRecipeFromUrl — robust fallback chain', () => {
  let api: MealieApi;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    api = makeApi();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function jsonOk(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  function textOk(body: string): Response {
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  }

  function errorResponse(status: number, body: unknown = { detail: 'err' }): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('path 1: Mealie /create/url succeeds — no fallback needed', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      calls.push(url);
      if (url.endsWith('/api/recipes/create/url')) {
        return jsonOk('happy-slug');
      }
      throw new Error(`unexpected: ${url}`);
    }) as typeof fetch;

    const slug = await api.createRecipeFromUrl('https://example.com/r');
    expect(slug).toBe('happy-slug');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/create\/url$/);
  });

  it('path 2: Mealie 400 → direct fetch succeeds → HTML posted to /html-or-json', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      calls.push(url);
      if (url.endsWith('/api/recipes/create/url')) {
        return errorResponse(400);
      }
      if (url === 'https://example.com/r') {
        // Confirm we sent a browser UA
        const headers = init?.headers as Record<string, string>;
        expect(headers['User-Agent']).toMatch(/Chrome/);
        return textOk('<html>recipe html</html>');
      }
      if (url.endsWith('/api/recipes/create/html-or-json')) {
        const body = JSON.parse(init?.body as string);
        expect(body.data).toBe('<html>recipe html</html>');
        expect(body.url).toBe('https://example.com/r');
        return jsonOk('recovered-slug');
      }
      throw new Error(`unexpected: ${url}`);
    }) as typeof fetch;

    const slug = await api.createRecipeFromUrl('https://example.com/r');
    expect(slug).toBe('recovered-slug');
    expect(calls.filter((c) => c.endsWith('create/url'))).toHaveLength(1);
    expect(calls.filter((c) => c.endsWith('html-or-json'))).toHaveLength(1);
  });

  it('path 3: Mealie 400 + direct blocked → Wayback serves archived HTML', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.endsWith('/api/recipes/create/url')) return errorResponse(400);
      if (url === 'https://example.com/r') return errorResponse(403); // blocked
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonOk({
          archived_snapshots: {
            closest: {
              url: 'https://web.archive.org/web/20250101000000/https://example.com/r',
              status: '200',
            },
          },
        });
      }
      if (url.includes('/web/20250101000000id_/')) {
        return textOk('<html>archived recipe</html>');
      }
      if (url.endsWith('/api/recipes/create/html-or-json')) {
        const body = JSON.parse(init?.body as string);
        expect(body.data).toBe('<html>archived recipe</html>');
        return jsonOk('archive-slug');
      }
      throw new Error(`unexpected: ${url}`);
    }) as typeof fetch;

    const slug = await api.createRecipeFromUrl('https://example.com/r');
    expect(slug).toBe('archive-slug');
  });

  it('path 4: all fallbacks fail → throws with descriptive error listing tried strategies', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.endsWith('/api/recipes/create/url')) return errorResponse(400);
      if (url === 'https://example.com/r') return errorResponse(403);
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonOk({}); // no snapshot
      }
      throw new Error(`unexpected: ${url}`);
    }) as typeof fetch;

    await expect(
      api.createRecipeFromUrl('https://example.com/r'),
    ).rejects.toThrow(/all strategies failed: native, .*direct_blocked.*wayback_unavailable/);
  });

  it('path 5: Mealie rejects HTML (recipe_scrapers whitelist) → JSON-LD extraction succeeds', async () => {
    const htmlWithJsonLd = `
      <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Hand-Extracted Pancakes",
        "description": "Parsed by our MCP, not Mealie",
        "recipeIngredient": ["2 cups flour", "1 tsp salt"],
        "recipeInstructions": [
          {"@type": "HowToStep", "text": "Mix dry."},
          {"@type": "HowToStep", "text": "Add wet."}
        ],
        "recipeYield": "4 servings",
        "totalTime": "PT30M",
        "image": "https://example.com/img.jpg"
      }
      </script>
      </head><body></body></html>
    `;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.endsWith('/api/recipes/create/url')) return errorResponse(400);
      if (url === 'https://example.com/r') return textOk(htmlWithJsonLd);
      if (url.endsWith('/api/recipes/create/html-or-json')) return errorResponse(400);
      // createRecipe: POST /api/recipes then PUT for ingredients/instructions
      if (url.endsWith('/api/recipes') && init?.method === 'POST') {
        return jsonOk({ slug: 'hand-extracted-pancakes' });
      }
      // getRecipe for update flow
      if (url.includes('/api/recipes/hand-extracted-pancakes')) {
        if (init?.method === 'PUT') {
          return jsonOk({
            slug: 'hand-extracted-pancakes',
            name: 'Hand-Extracted Pancakes',
          });
        }
        return jsonOk({
          slug: 'hand-extracted-pancakes',
          name: 'Hand-Extracted Pancakes',
          recipeIngredient: [],
          recipeInstructions: [],
        });
      }
      // parser and food/unit resolution for originalText path
      if (url.endsWith('/api/parser/ingredient')) {
        return jsonOk({
          ingredient: {
            quantity: 2,
            unit: { id: 'u1', name: 'cup' },
            food: { id: 'f1', name: 'flour' },
            note: '',
            display: '2 cup flour',
            originalText: '2 cups flour',
            referenceId: 'r1',
          },
        });
      }
      if (url.endsWith('/image')) {
        // image upload endpoint — not strictly exercised here
        return new Response('', { status: 200 });
      }
      // Image download
      if (url === 'https://example.com/img.jpg') {
        return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 });
      }
      throw new Error(`unexpected: ${url} (method=${init?.method ?? 'GET'})`);
    }) as typeof fetch;

    const slug = await api.createRecipeFromUrl('https://example.com/r');
    expect(slug).toBe('hand-extracted-pancakes');
  });

  it('non-400 errors from Mealie are not swallowed', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.endsWith('/api/recipes/create/url')) return errorResponse(500);
      throw new Error(`unexpected: ${url}`);
    }) as typeof fetch;

    await expect(
      api.createRecipeFromUrl('https://example.com/r'),
    ).rejects.toThrow(/500/);
  });
});

describe('resolveOrCreateUnit', () => {
  let api: MealieApi;

  beforeEach(() => {
    api = makeApi();
  });

  it('returns existing unit on exact match', async () => {
    vi.spyOn(api, 'listUnits').mockResolvedValue({
      items: [{ id: UNIT_ID, name: 'tablespoon', pluralName: 'tablespoons' }],
    });
    const createSpy = vi.spyOn(api, 'createUnit');

    const result = await api.resolveOrCreateUnit('tablespoon');

    expect(result?.id).toBe(UNIT_ID);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('matches plural variant against existing singular', async () => {
    vi.spyOn(api, 'listUnits').mockResolvedValue({
      items: [{ id: UNIT_ID, name: 'cup', pluralName: null }],
    });

    const result = await api.resolveOrCreateUnit('cups');

    expect(result?.id).toBe(UNIT_ID);
  });

  it('creates when not found', async () => {
    vi.spyOn(api, 'listUnits').mockResolvedValue({ items: [] });
    const createSpy = vi
      .spyOn(api, 'createUnit')
      .mockResolvedValue({ id: UNIT_ID, name: 'dram' });

    const result = await api.resolveOrCreateUnit('dram');

    expect(createSpy).toHaveBeenCalledWith('dram');
    expect(result?.id).toBe(UNIT_ID);
  });
});
