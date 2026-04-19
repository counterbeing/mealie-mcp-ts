import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.spyOn(api, 'createUnit').mockResolvedValue({ id: UNIT_ID, name: 'cup' });
    vi.spyOn(api, 'createFood').mockResolvedValue({
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
    vi.spyOn(api, 'createUnit').mockResolvedValue({ id: UNIT_ID, name: 'lb' });
    vi.spyOn(api, 'createFood').mockResolvedValue({
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

  it('falls back to null unit when createUnit throws', async () => {
    vi.spyOn(api, 'parseIngredient').mockResolvedValue({
      quantity: 1,
      unit: { id: '', name: 'weirdunit' },
      food: { id: FOOD_ID, name: 'flour' },
      note: '',
      display: '1 weirdunit flour',
      originalText: '1 weirdunit flour',
      referenceId: 'r1',
    } as never);
    vi.spyOn(api, 'createUnit').mockRejectedValue(new Error('conflict'));

    const result = (await api.parseIngredients([
      { originalText: '1 weirdunit flour' },
    ])) as Array<{ unit: unknown }>;

    expect(result[0].unit).toBeNull();
  });
});
