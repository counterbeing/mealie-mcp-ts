/**
 * Comprehensive MCP Happy Path Test
 *
 * Tests the full workflow of creating a recipe with:
 * - Sectioned ingredients (parsed via originalText)
 * - Sectioned instructions
 * - Image upload
 * - Verification of all data
 */

import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';
import { allTools, getToolByName } from './src/tools.js';

const config = loadConfig();
const api = new MealieApi(config);

// Helper to call a tool by name
async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = getToolByName(toolName);
  if (!tool) throw new Error(`Tool not found: ${toolName}`);
  console.log(`\n📞 Calling tool: ${toolName}`);
  const result = await tool.handler(api, args);
  return result;
}

async function runHappyPathTest() {
  console.log('🧪 MCP Happy Path Test');
  console.log('='.repeat(50));

  const recipeName = 'Test: Beef Tacos with Homemade Salsa';
  const recipeSlug = 'test-beef-tacos-with-homemade-salsa';

  // Clean up any existing test recipe
  try {
    await callTool('delete_recipe', { slug: recipeSlug });
    console.log('   Cleaned up existing test recipe');
  } catch {
    // Recipe doesn't exist, that's fine
  }

  // ============================================
  // TEST 1: Create recipe with sections & parsed ingredients
  // ============================================
  console.log('\n\n📝 TEST 1: Create Recipe');
  console.log('-'.repeat(50));

  const createResult = await callTool('create_recipe', {
    name: recipeName,
    description:
      'Delicious beef tacos with a fresh homemade salsa, perfect for taco night!',
    recipeYield: '4 servings (12 tacos)',
    prepTime: '20 minutes',
    cookTime: '15 minutes',
    totalTime: '35 minutes',
    recipeIngredient: [
      // Beef section
      { title: 'For the Beef' },
      { originalText: '1 pound ground beef' },
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
    recipeInstructions: [
      {
        title: 'Make the Salsa',
        text: 'Combine diced tomatoes, red onion, jalapeño, and cilantro in a bowl. Add lime juice and salt, mix well. Refrigerate while preparing the beef.',
      },
      {
        title: 'Cook the Beef',
        text: 'Heat olive oil in a large skillet over medium-high heat. Add onion and cook until softened, about 3 minutes.',
      },
      {
        text: 'Add ground beef and break it up with a spatula. Cook until browned, about 5-7 minutes.',
      },
      {
        text: 'Add garlic, cumin, chili powder, and paprika. Stir and cook for 1 minute until fragrant. Season with salt and pepper.',
      },
      {
        title: 'Assemble Tacos',
        text: 'Warm tortillas in a dry skillet or microwave. Fill each tortilla with seasoned beef, top with fresh salsa, cheese, sour cream, and avocado slices.',
      },
      {
        text: 'Serve immediately with lime wedges on the side.',
      },
    ],
  });

  console.log('   ✅ Recipe created:', createResult);

  // ============================================
  // TEST 2: Upload image
  // ============================================
  console.log('\n\n🖼️  TEST 2: Upload Image');
  console.log('-'.repeat(50));

  // Download a taco image
  const imageUrl =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg/640px-001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg';
  console.log('   Downloading image from Wikipedia...');

  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');
  console.log(`   Image size: ${Math.round(imageBase64.length / 1024)} KB`);

  await callTool('upload_recipe_image', {
    slug: recipeSlug,
    imageBase64: imageBase64,
    fileName: 'tacos.jpg',
  });
  console.log('   ✅ Image uploaded');

  // ============================================
  // TEST 3: Verify recipe with get_recipe
  // ============================================
  console.log('\n\n🔍 TEST 3: Verify Recipe');
  console.log('-'.repeat(50));

  const recipe = (await callTool('get_recipe', {
    slug: recipeSlug,
  })) as {
    name: string;
    description: string;
    ingredients: Array<{
      title?: string;
      quantity?: number;
      unit?: string;
      food?: string;
      note?: string;
    }>;
    instructions: Array<{ title?: string; text: string }>;
  };

  // Also fetch raw recipe to check image
  const rawRecipe = await api.getRecipe(recipeSlug);

  console.log(`\n   Recipe: ${recipe.name}`);
  console.log(`   Description: ${recipe.description}`);
  console.log(`   Has Image: ${rawRecipe.image !== null ? '✅ Yes' : '❌ No'}`);

  // Count sections and ingredients
  const ingredientSections = new Set<string>();
  let ingredientCount = 0;
  for (const ing of recipe.ingredients || []) {
    if (ing.title) ingredientSections.add(ing.title);
    if (ing.food || ing.quantity) ingredientCount++;
  }

  const instructionSections = new Set<string>();
  for (const inst of recipe.instructions || []) {
    if (inst.title) instructionSections.add(inst.title);
  }

  console.log(`\n   Ingredients: ${ingredientCount} items`);
  console.log(
    `   Ingredient Sections: ${ingredientSections.size} (${[...ingredientSections].join(', ')})`,
  );
  console.log(`   Instructions: ${recipe.instructions?.length || 0} steps`);
  console.log(
    `   Instruction Sections: ${instructionSections.size} (${[...instructionSections].join(', ')})`,
  );

  // Print ingredients by section
  console.log('\n   📋 Ingredients:');
  let currentSection = '';
  for (const ing of recipe.ingredients || []) {
    if (ing.title && ing.title !== currentSection) {
      currentSection = ing.title;
      console.log(`\n   [${ing.title}]`);
    }
    if (ing.food || ing.quantity) {
      const qty = ing.quantity || '';
      const unit = ing.unit || '';
      const food = ing.food || '';
      const note = ing.note ? `(${ing.note})` : '';
      console.log(`     • ${[qty, unit, food, note].filter(Boolean).join(' ')}`);
    }
  }

  // ============================================
  // TEST 4: Verify recipe appears in list
  // ============================================
  console.log('\n\n📋 TEST 4: Verify in Recipe List');
  console.log('-'.repeat(50));

  const listResult = (await callTool('list_recipes', {
    page: 1,
    perPage: 50,
  })) as {
    recipes: Array<{ name: string; slug: string }>;
    total: number;
  };
  const found = listResult.recipes?.find(
    (r: { slug: string }) => r.slug === recipeSlug,
  );
  console.log(
    `   Recipe in list: ${found ? '✅ Yes' : '❌ No'} (${listResult.total} total recipes)`,
  );

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const tests = [
    { name: 'Recipe created', pass: !!createResult },
    { name: 'Image uploaded', pass: recipe.image !== null },
    { name: 'Ingredient sections', pass: ingredientSections.size === 3 },
    { name: 'Instruction sections', pass: instructionSections.size === 3 },
    { name: 'Ingredients parsed', pass: ingredientCount >= 15 },
    { name: 'Recipe in list', pass: !!found },
  ];

  let allPassed = true;
  for (const test of tests) {
    console.log(`   ${test.pass ? '✅' : '❌'} ${test.name}`);
    if (!test.pass) allPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('='.repeat(50));
}

runHappyPathTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
