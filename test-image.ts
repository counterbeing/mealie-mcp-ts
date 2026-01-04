import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';

const api = new MealieApi(loadConfig());

async function createRecipeWithImage() {
  // Create a simple recipe
  console.log('Creating recipe...');
  const slug = await api.createRecipe({
    name: 'Classic Margherita Pizza',
    description:
      'A simple and delicious Italian pizza with fresh tomatoes, mozzarella, and basil',
    recipeYield: '2 pizzas',
    prepTime: '30 minutes',
    cookTime: '15 minutes',
    totalTime: '45 minutes',
    recipeIngredient: [
      { title: 'For the Dough' },
      { originalText: '2 1/4 teaspoons active dry yeast' },
      { originalText: '1 cup warm water' },
      { originalText: '3 cups all-purpose flour' },
      { originalText: '2 tablespoons olive oil' },
      { originalText: '1 teaspoon salt' },
      { originalText: '1 teaspoon sugar' },
      { title: 'For the Topping' },
      { originalText: '1 cup tomato sauce' },
      { originalText: '8 ounces fresh mozzarella, sliced' },
      { originalText: '1/4 cup fresh basil leaves' },
      { originalText: '2 tablespoons olive oil' },
      { originalText: 'salt and pepper to taste' },
    ],
    recipeInstructions: [
      {
        title: 'Make the Dough',
        text: 'Dissolve yeast in warm water and let sit for 5 minutes until foamy. Mix flour, salt, and sugar in a large bowl. Add yeast mixture and olive oil, knead until smooth. Let rise for 1 hour.',
      },
      {
        text: 'Punch down dough and divide in half. Roll each portion into a 12-inch circle on a floured surface.',
      },
      {
        title: 'Assemble and Bake',
        text: 'Preheat oven to 475°F (245°C). Place dough on a baking sheet or pizza stone.',
      },
      {
        text: 'Spread tomato sauce over dough, leaving a 1-inch border. Arrange mozzarella slices on top. Drizzle with olive oil.',
      },
      {
        text: 'Bake for 12-15 minutes until crust is golden and cheese is bubbly. Top with fresh basil leaves and serve immediately.',
      },
    ],
  });

  console.log('Created recipe:', slug);

  // Download a pizza image and convert to base64
  console.log('Downloading image...');
  const imageUrl =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Eq_it-na_pizza-margherita_sep2005_sml.jpg/800px-Eq_it-na_pizza-margherita_sep2005_sml.jpg';

  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  console.log('Image size:', Math.round(base64.length / 1024), 'KB (base64)');

  // Upload the image
  console.log('Uploading image to recipe...');
  await api.uploadRecipeImage(slug, base64, 'pizza.jpg');

  console.log('Image uploaded successfully!');

  // Verify the recipe has an image
  const recipe = await api.getRecipe(slug);
  console.log('\nRecipe:', recipe.name);
  console.log('Slug:', recipe.slug);
  console.log('Has image:', recipe.image !== null);
  console.log(
    'Image URL:',
    `${process.env.MEALIE_URL}/api/media/recipes/${recipe.id}/images/original.webp`,
  );
}

createRecipeWithImage().catch(console.error);
