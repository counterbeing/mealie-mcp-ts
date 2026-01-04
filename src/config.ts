import { z } from 'zod';

const ALL_TOOLS = [
  // Recipe tools
  'list_recipes',
  'get_recipe',
  'create_recipe',
  'update_recipe',
  'delete_recipe',
  'upload_recipe_image',
  // Food tools
  'list_foods',
  'create_food',
  // Shopping list tools
  'list_shopping_lists',
  'get_shopping_list',
  'add_shopping_list_item',
  'update_shopping_list_item',
  'delete_shopping_list_item',
  'add_recipe_to_shopping_list',
  // Category tools
  'list_categories',
  'create_category',
  // Tag tools
  'list_tags',
  'create_tag',
  // Recipe URL scraping tools
  'test_scrape_url',
  'create_recipe_from_url',
  // Meal planning tools
  'list_meal_plans',
  'get_todays_meal_plan',
  'create_meal_plan',
  'delete_meal_plan',
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

const configSchema = z.object({
  mealieUrl: z
    .string()
    .url('MEALIE_URL must be a valid URL')
    .transform((url) => url.replace(/\/$/, '')),
  mealieApiKey: z.string().min(1, 'MEALIE_API_KEY is required'),
  enabledTools: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') {
        return ALL_TOOLS as readonly ToolName[];
      }
      const tools = val.split(',').map((t) => t.trim()) as ToolName[];
      const invalid = tools.filter((t) => !ALL_TOOLS.includes(t));
      if (invalid.length > 0) {
        throw new Error(
          `Invalid tools: ${invalid.join(', ')}. Valid tools are: ${ALL_TOOLS.join(', ')}`,
        );
      }
      return tools;
    }),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    mealieUrl: process.env.MEALIE_URL,
    mealieApiKey: process.env.MEALIE_API_KEY,
    enabledTools: process.env.ENABLED_TOOLS,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration error:\n${errors}`);
  }

  return result.data;
}

export function isToolEnabled(config: Config, toolName: ToolName): boolean {
  return config.enabledTools.includes(toolName);
}

export { ALL_TOOLS };
