import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';
import { getToolByName } from './src/tools.js';

const api = new MealieApi(loadConfig());

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = getToolByName(toolName);
  if (!tool) throw new Error(`Tool not found: ${toolName}`);
  return tool.handler(api, args);
}

async function testUpdate() {
  const slug = 'test-beef-tacos-with-homemade-salsa';

  // Get current recipe
  console.log('📖 Getting current recipe...\n');
  const before = (await callTool('get_recipe', { slug })) as {
    name: string;
    ingredients: Array<{
      title?: string;
      quantity?: number;
      unit?: string;
      food?: string;
    }>;
  };

  console.log('Current ingredients (beef section):');
  let inBeefSection = false;
  for (const ing of before.ingredients) {
    if (ing.title === 'For the Beef') inBeefSection = true;
    else if (ing.title && ing.title !== 'For the Beef') inBeefSection = false;

    if (inBeefSection && ing.food) {
      console.log(`  • ${ing.quantity} ${ing.unit} ${ing.food}`);
    }
  }

  // Update: Change ground beef from 1 pound to 2 pounds
  console.log(
    '\n✏️  Updating: changing ground beef from 1 pound to 2 pounds...\n',
  );

  await callTool('update_recipe', {
    slug,
    recipeIngredient: [
      // Beef section - note the changed quantity
      { title: 'For the Beef' },
      { originalText: '2 pounds ground beef' }, // Changed from 1 to 2 pounds
      { originalText: '1 tablespoon olive oil' },
      { originalText: '1 medium onion, diced' },
      { originalText: '3 cloves garlic, minced' },
      { originalText: '2 teaspoons cumin' },
      { originalText: '1 teaspoon chili powder' },
      { originalText: '1/2 teaspoon paprika' },
      { originalText: 'salt and pepper to taste' },
      // Salsa section
      { title: 'For the Salsa' },
      { originalText: '4 medium tomatoes, diced' },
      { originalText: '1/2 red onion, finely diced' },
      { originalText: '1 jalapeño, seeded and minced' },
      { originalText: '1/4 cup fresh cilantro, chopped' },
      { originalText: '1 lime, juiced' },
      { originalText: '1/2 teaspoon salt' },
      // Serving section
      { title: 'For Serving' },
      { originalText: '12 small corn tortillas' },
      { originalText: '1 cup shredded cheese' },
      { originalText: '1/2 cup sour cream' },
      { originalText: '1 avocado, sliced' },
    ],
  });

  // Verify the update
  console.log('📖 Getting updated recipe...\n');
  const after = (await callTool('get_recipe', { slug })) as {
    name: string;
    ingredients: Array<{
      title?: string;
      quantity?: number;
      unit?: string;
      food?: string;
    }>;
  };

  console.log('Updated ingredients (beef section):');
  inBeefSection = false;
  for (const ing of after.ingredients) {
    if (ing.title === 'For the Beef') inBeefSection = true;
    else if (ing.title && ing.title !== 'For the Beef') inBeefSection = false;

    if (inBeefSection && ing.food) {
      const marker = ing.food === 'ground beef' ? ' ← UPDATED' : '';
      console.log(`  • ${ing.quantity} ${ing.unit} ${ing.food}${marker}`);
    }
  }

  console.log('\n✅ Recipe updated successfully!');
}

testUpdate().catch(console.error);
