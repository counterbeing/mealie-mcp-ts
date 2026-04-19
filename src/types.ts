import { z } from 'zod';

// Base schemas for common types
export const ingredientUnitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  pluralName: z.string().nullish(),
  description: z.string().optional().default(''),
  abbreviation: z.string().optional().default(''),
  fraction: z.boolean().optional().default(true),
  useAbbreviation: z.boolean().optional().default(false),
});

export const ingredientFoodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  pluralName: z.string().nullish(),
  description: z.string().optional().default(''),
  labelId: z.string().uuid().nullish(),
});

export const createIngredientFoodSchema = z.object({
  name: z.string(),
  pluralName: z.string().nullish(),
  description: z.string().optional().default(''),
  labelId: z.string().uuid().nullish(),
});

// Recipe Ingredient schema
export const recipeIngredientSchema = z.object({
  referenceId: z.string().uuid().optional(),
  quantity: z.number().nullish().default(0),
  unit: ingredientUnitSchema.nullish(),
  food: ingredientFoodSchema.nullish(),
  note: z.string().nullish().default(''),
  display: z.string().optional().default(''),
  title: z.string().nullish(),
  originalText: z.string().nullish(),
});

// Recipe Step/Instruction schema
export const recipeStepSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().nullish().default(''),
  summary: z.string().nullish().default(''),
  text: z.string(),
  ingredientReferences: z
    .array(
      z.object({
        referenceId: z.string().uuid().optional(),
      }),
    )
    .optional()
    .default([]),
});

// Recipe Category and Tag schemas
export const recipeCategorySchema = z.object({
  id: z.string().uuid().nullish(),
  groupId: z.string().uuid().nullish(),
  name: z.string(),
  slug: z.string(),
});

export const recipeTagSchema = z.object({
  id: z.string().uuid().nullish(),
  groupId: z.string().uuid().nullish(),
  name: z.string(),
  slug: z.string(),
});

export const recipeToolSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  slug: z.string().optional(),
  onHand: z.boolean().optional().default(false),
});

// Recipe Summary schema (for list responses)
export const recipeSummarySchema = z.object({
  id: z.string().uuid().nullish(),
  userId: z.string().uuid().optional(),
  householdId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  name: z.string().nullish(),
  slug: z.string().default(''),
  image: z.unknown().nullish(),
  recipeServings: z.number().optional().default(0),
  recipeYieldQuantity: z.number().optional().default(0),
  recipeYield: z.string().nullish(),
  totalTime: z.string().nullish(),
  prepTime: z.string().nullish(),
  cookTime: z.string().nullish(),
  performTime: z.string().nullish(),
  description: z.string().nullish().default(''),
  recipeCategory: z.array(recipeCategorySchema).nullish().default([]),
  tags: z.array(recipeTagSchema).nullish().default([]),
  tools: z.array(recipeToolSchema).optional().default([]),
  rating: z.number().nullish(),
  orgURL: z.string().nullish(),
  dateAdded: z.string().nullish(),
  dateUpdated: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  lastMade: z.string().nullish(),
});

// Full Recipe schema (for get response)
export const recipeSchema = recipeSummarySchema.extend({
  recipeIngredient: z.array(recipeIngredientSchema).optional().default([]),
  recipeInstructions: z.array(recipeStepSchema).optional().default([]),
  nutrition: z
    .object({
      calories: z.string().nullish(),
      fatContent: z.string().nullish(),
      proteinContent: z.string().nullish(),
      carbohydrateContent: z.string().nullish(),
      fiberContent: z.string().nullish(),
      sodiumContent: z.string().nullish(),
      sugarContent: z.string().nullish(),
    })
    .nullish(),
  notes: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional()
    .default([]),
  assets: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string(),
        icon: z.string().optional(),
        fileName: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  extras: z.record(z.string(), z.unknown()).default({}),
});

// Pagination wrapper
export const paginationSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    page: z.number().default(1),
    per_page: z.number().default(10),
    total: z.number().default(0),
    total_pages: z.number().default(0),
    items: z.array(itemSchema),
    next: z.string().nullish(),
    previous: z.string().nullish(),
  });

// Recipe pagination
export const recipePaginationSchema = paginationSchema(recipeSummarySchema);

// Food pagination
export const foodPaginationSchema = paginationSchema(ingredientFoodSchema);

// Shopping List Item schema
export const shoppingListItemSchema = z.object({
  id: z.string().uuid().optional(),
  shoppingListId: z.string().uuid(),
  quantity: z.number().default(1),
  unit: ingredientUnitSchema.nullish(),
  food: ingredientFoodSchema.nullish(),
  note: z.string().nullish().default(''),
  display: z.string().optional().default(''),
  checked: z.boolean().default(false),
  position: z.number().default(0),
  foodId: z.string().uuid().nullish(),
  labelId: z.string().uuid().nullish(),
  unitId: z.string().uuid().nullish(),
  isFood: z.boolean().optional(),
  extras: z.record(z.string(), z.unknown()).default({}),
});

// Shopping List Summary schema
export const shoppingListSummarySchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  householdId: z.string().uuid().optional(),
  name: z.string().nullish(),
  extras: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

// Full Shopping List schema
export const shoppingListSchema = shoppingListSummarySchema.extend({
  listItems: z.array(shoppingListItemSchema).default([]),
  recipeReferences: z
    .array(
      z.object({
        id: z.string().uuid(),
        shoppingListId: z.string().uuid(),
        recipeId: z.string().uuid(),
        recipeQuantity: z.number(),
        recipe: recipeSummarySchema.optional(),
      }),
    )
    .default([]),
  labelSettings: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        shoppingListId: z.string().uuid().optional(),
        labelId: z.string().uuid().optional(),
        position: z.number().optional(),
      }),
    )
    .default([]),
});

// Shopping List pagination
export const shoppingListPaginationSchema = paginationSchema(
  shoppingListSummarySchema,
);

// ============ Categories & Tags (for organizers) ============

// Category output schema (uses existing recipeCategorySchema structure)
export const categoryOutSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

export const categoryPaginationSchema = paginationSchema(categoryOutSchema);

// Tag output schema (uses existing recipeTagSchema structure)
export const tagOutSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

export const tagPaginationSchema = paginationSchema(tagOutSchema);

// ============ Meal Planning ============

export const planEntryTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'side',
  'snack',
  'drink',
  'dessert',
]);

export const mealPlanEntrySchema = z.object({
  id: z.number().optional(),
  date: z.string(), // YYYY-MM-DD format
  entryType: planEntryTypeSchema.default('dinner'),
  title: z.string().default(''),
  text: z.string().default(''),
  recipeId: z.string().uuid().nullish(),
  groupId: z.string().uuid().optional(),
  householdId: z.string().uuid().optional(),
  recipe: recipeSummarySchema.nullish(),
});

export const mealPlanPaginationSchema = paginationSchema(mealPlanEntrySchema);

export const createMealPlanInputSchema = z.object({
  date: z.string().describe('Date for the meal plan entry (YYYY-MM-DD format)'),
  entryType: planEntryTypeSchema
    .optional()
    .default('dinner')
    .describe(
      'Type of meal: breakfast, lunch, dinner, side, snack, drink, or dessert',
    ),
  title: z
    .string()
    .optional()
    .default('')
    .describe('Optional title for the meal plan entry'),
  text: z
    .string()
    .optional()
    .default('')
    .describe('Optional notes or description'),
  recipeId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional recipe ID to link to this meal plan entry'),
});

// ============ Shopping List Improvements ============

export const updateShoppingListItemInputSchema = z.object({
  itemId: z.string().uuid().describe('ID of the shopping list item to update'),
  quantity: z.number().optional().describe('New quantity'),
  note: z.string().optional().describe('New note/display text'),
  checked: z.boolean().optional().describe('Whether the item is checked off'),
});

export const addRecipeToListInputSchema = z.object({
  shoppingListId: z.string().uuid().describe('ID of the shopping list'),
  recipeId: z
    .string()
    .uuid()
    .describe('ID of the recipe to add ingredients from'),
  recipeQuantity: z
    .number()
    .optional()
    .default(1)
    .describe('Number of servings/portions to add (default: 1)'),
});

// Type exports
export type IngredientUnit = z.infer<typeof ingredientUnitSchema>;
export type IngredientFood = z.infer<typeof ingredientFoodSchema>;
export type CreateIngredientFood = z.infer<typeof createIngredientFoodSchema>;
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeCategory = z.infer<typeof recipeCategorySchema>;
export type RecipeTag = z.infer<typeof recipeTagSchema>;
export type RecipeTool = z.infer<typeof recipeToolSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipePagination = z.infer<typeof recipePaginationSchema>;
export type FoodPagination = z.infer<typeof foodPaginationSchema>;
export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type ShoppingListSummary = z.infer<typeof shoppingListSummarySchema>;
export type ShoppingList = z.infer<typeof shoppingListSchema>;
export type ShoppingListPagination = z.infer<
  typeof shoppingListPaginationSchema
>;

// Input schemas for tool parameters
export const createRecipeInputSchema = z.object({
  name: z.string().describe('Name of the recipe'),
  description: z.string().optional().describe('Description of the recipe'),
  recipeYield: z
    .string()
    .optional()
    .describe('Yield of the recipe (e.g., "4 servings")'),
  totalTime: z.string().optional().describe('Total time (e.g., "30 minutes")'),
  prepTime: z.string().optional().describe('Prep time (e.g., "10 minutes")'),
  cookTime: z.string().optional().describe('Cook time (e.g., "20 minutes")'),
  recipeIngredient: z
    .array(
      z.object({
        originalText: z
          .string()
          .optional()
          .describe(
            'Natural language ingredient text to be parsed (e.g., "2 cups flour"). When provided, the ingredient will be automatically parsed into quantity, unit, and food.',
          ),
        quantity: z.number().optional().describe('Quantity of the ingredient'),
        unit: z
          .object({
            name: z.string().describe('Unit name (e.g., "cup", "tablespoon")'),
          })
          .optional()
          .describe('Unit of measurement'),
        food: z
          .object({
            name: z.string().describe('Food name (e.g., "flour", "sugar")'),
          })
          .optional()
          .describe('Food item'),
        note: z
          .string()
          .optional()
          .describe('Additional notes for the ingredient'),
        title: z
          .string()
          .optional()
          .describe('Section title for ingredient grouping'),
      }),
    )
    .optional()
    .describe(
      'List of ingredients. Each ingredient can either have originalText (to be parsed automatically) or structured fields (quantity, unit, food, note).',
    ),
  recipeInstructions: z
    .array(
      z.object({
        title: z
          .string()
          .optional()
          .describe('Section title for instruction grouping'),
        text: z.string().describe('Instruction text'),
      }),
    )
    .optional()
    .describe('List of instructions'),
});

export const updateRecipeInputSchema = createRecipeInputSchema
  .partial()
  .extend({
    slug: z.string().describe('Recipe slug to update'),
  });

export const shoppingListItemInputSchema = z.object({
  shoppingListId: z.string().uuid().describe('ID of the shopping list'),
  note: z.string().optional().describe('Note or display text for the item'),
  quantity: z.number().optional().default(1).describe('Quantity of the item'),
  unit: z
    .object({
      name: z.string().describe('Unit name'),
    })
    .optional()
    .describe('Unit of measurement'),
  food: z
    .object({
      name: z.string().describe('Food name'),
    })
    .optional()
    .describe('Food item'),
  checked: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether the item is checked'),
});

export type CreateRecipeInput = z.infer<typeof createRecipeInputSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeInputSchema>;
export type ShoppingListItemInput = z.infer<typeof shoppingListItemInputSchema>;

// New type exports for Categories, Tags, Meal Plans, Shopping List improvements
export type CategoryOut = z.infer<typeof categoryOutSchema>;
export type CategoryPagination = z.infer<typeof categoryPaginationSchema>;
export type TagOut = z.infer<typeof tagOutSchema>;
export type TagPagination = z.infer<typeof tagPaginationSchema>;
export type PlanEntryType = z.infer<typeof planEntryTypeSchema>;
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;
export type MealPlanPagination = z.infer<typeof mealPlanPaginationSchema>;
export type CreateMealPlanInput = z.infer<typeof createMealPlanInputSchema>;
export type UpdateShoppingListItemInput = z.infer<
  typeof updateShoppingListItemInputSchema
>;
export type AddRecipeToListInput = z.infer<typeof addRecipeToListInputSchema>;

// Current user schema (for debugging group context)
export const currentUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  admin: z.boolean(),
  group: z.string(),
  groupId: z.string().uuid(),
  groupSlug: z.string(),
  household: z.string(),
  householdId: z.string().uuid(),
  householdSlug: z.string(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
