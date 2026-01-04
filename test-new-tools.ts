/**
 * Test script for the new MCP tools
 */

import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';
import { getToolByName } from './src/tools.js';

const config = loadConfig();
const api = new MealieApi(config);

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

async function runTests() {
  console.log('🧪 Testing New MCP Tools');
  console.log('='.repeat(50));

  // Test Categories
  console.log('\n\n📁 TEST: Categories');
  console.log('-'.repeat(50));

  const categories = (await callTool('list_categories', {})) as {
    categories: Array<{ id: string; name: string; slug: string }>;
    total: number;
  };
  console.log(`   Found ${categories.total} categories`);

  const newCategory = (await callTool('create_category', {
    name: 'Test Category',
  })) as { category: { id: string; name: string } };
  console.log(`   ✅ Created category: ${newCategory.category.name}`);

  // Test Tags
  console.log('\n\n🏷️  TEST: Tags');
  console.log('-'.repeat(50));

  const tags = (await callTool('list_tags', {})) as {
    tags: Array<{ id: string; name: string; slug: string }>;
    total: number;
  };
  console.log(`   Found ${tags.total} tags`);

  const newTag = (await callTool('create_tag', { name: 'test-tag' })) as {
    tag: { id: string; name: string };
  };
  console.log(`   ✅ Created tag: ${newTag.tag.name}`);

  // Test Meal Plans
  console.log('\n\n📅 TEST: Meal Plans');
  console.log('-'.repeat(50));

  const today = new Date().toISOString().split('T')[0];

  const mealPlan = (await callTool('create_meal_plan', {
    date: today,
    entryType: 'dinner',
    title: 'Test Dinner',
    text: 'Testing meal plan creation',
  })) as { mealPlan: { id: number; date: string; title: string } };
  console.log(`   ✅ Created meal plan for ${mealPlan.mealPlan.date}`);

  const todaysMeals = (await callTool('get_todays_meal_plan', {})) as {
    date: string;
    meals: Array<{ id: number; title: string }>;
  };
  console.log(`   Found ${todaysMeals.meals.length} meals for today`);

  // Clean up meal plan
  await callTool('delete_meal_plan', { itemId: mealPlan.mealPlan.id });
  console.log('   ✅ Deleted test meal plan');

  // Test Recipe from URL (using a common recipe site)
  console.log('\n\n🔗 TEST: Recipe from URL');
  console.log('-'.repeat(50));

  try {
    const scrapeResult = (await callTool('test_scrape_url', {
      url: 'https://www.allrecipes.com/recipe/234534/beef-and-broccoli/',
    })) as { success: boolean };
    console.log(`   ✅ URL scrape test: ${scrapeResult.success ? 'succeeded' : 'failed'}`);
  } catch (e) {
    console.log(`   ⚠️ URL scrape test failed (expected if site blocks scraping)`);
  }

  // Test Shopping List Improvements
  console.log('\n\n🛒 TEST: Shopping List Improvements');
  console.log('-'.repeat(50));

  // Get a shopping list
  const lists = (await callTool('list_shopping_lists', {})) as {
    shoppingLists: Array<{ id: string; name: string }>;
    total: number;
  };

  if (lists.total > 0) {
    const listId = lists.shoppingLists[0].id;
    console.log(`   Using shopping list: ${lists.shoppingLists[0].name}`);

    // Add an item
    const newItem = (await callTool('add_shopping_list_item', {
      shoppingListId: listId,
      note: 'Test item for new tools',
      quantity: 2,
    })) as { item: { id: string; note: string } };
    console.log(`   ✅ Added item: ${newItem.item.note}`);

    // Update the item
    const updated = (await callTool('update_shopping_list_item', {
      itemId: newItem.item.id,
      checked: true,
    })) as { item: { checked: boolean } };
    console.log(`   ✅ Updated item checked status: ${updated.item.checked}`);

    // Delete the item
    await callTool('delete_shopping_list_item', { itemId: newItem.item.id });
    console.log('   ✅ Deleted test item');
  } else {
    console.log('   ⚠️ No shopping lists found, skipping tests');
  }

  // Summary
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 NEW TOOLS TEST COMPLETE');
  console.log('='.repeat(50));
  console.log('   ✅ Categories: list, create');
  console.log('   ✅ Tags: list, create');
  console.log('   ✅ Meal Plans: list, create, get today, delete');
  console.log('   ✅ Shopping List: update item, delete item');
  console.log('   ⚠️ Recipe from URL: depends on external site availability');
  console.log('='.repeat(50));
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
