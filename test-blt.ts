import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';

const config = loadConfig();
const api = new MealieApi(config);

async function createBLT() {
  console.log('Creating BLT recipe with parsed ingredients...');

  const slug = await api.createRecipe({
    name: 'Perfect BLT Sandwich',
    description:
      'A classic bacon, lettuce, and tomato sandwich with crispy bacon and fresh ingredients',
    recipeYield: '2 sandwiches',
    prepTime: '10 minutes',
    cookTime: '10 minutes',
    totalTime: '20 minutes',
    recipeIngredient: [
      { originalText: '6 slices bacon, thick-cut' },
      { originalText: '4 slices bread, toasted' },
      { originalText: '2 tablespoons mayonnaise' },
      { originalText: '4 leaves lettuce, romaine or iceberg' },
      { originalText: '1 large tomato, sliced' },
    ],
    recipeInstructions: [
      {
        text: 'Cook bacon in a skillet over medium heat until crispy, about 4-5 minutes per side. Transfer to a paper towel-lined plate.',
      },
      { text: 'Toast the bread slices until golden brown.' },
      { text: 'Spread mayonnaise on one side of each bread slice.' },
      {
        text: 'Layer lettuce, tomato slices, and crispy bacon on two slices of bread.',
      },
      {
        text: 'Top with remaining bread slices, mayo side down. Cut in half and serve immediately.',
      },
    ],
  });

  console.log('Created recipe with slug:', slug);

  // Fetch and display the created recipe
  const recipe = await api.getRecipe(slug);
  console.log('\nRecipe details:');
  console.log('Name:', recipe.name);
  console.log('Slug:', recipe.slug);
  console.log('Description:', recipe.description);
  console.log('\nIngredients:');
  recipe.recipeIngredient?.forEach((i, idx) => {
    console.log(
      `  ${idx + 1}. qty=${i.quantity} unit=${i.unit?.name} food=${i.food?.name} note=${i.note}`,
    );
  });
  console.log('\nInstructions:', recipe.recipeInstructions?.length);
}

createBLT().catch(console.error);
