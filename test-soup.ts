import { MealieApi } from './src/api.js';
import { loadConfig } from './src/config.js';

const api = new MealieApi(loadConfig());

async function createSoup() {
  const slug = await api.createRecipe({
    name: 'Chicken Tortilla Soup',
    description:
      'A warming Mexican-inspired soup topped with crispy homemade tortilla strips, avocado, and fresh cilantro',
    recipeYield: '6 servings',
    prepTime: '20 minutes',
    cookTime: '35 minutes',
    totalTime: '55 minutes',
    recipeIngredient: [
      // Soup section
      { title: 'For the Soup' },
      { originalText: '2 tablespoons olive oil' },
      { originalText: '1 pound chicken breast, boneless skinless' },
      { originalText: '1 medium onion, diced' },
      { originalText: '4 cloves garlic, minced' },
      { originalText: '1 jalapeño, seeded and minced' },
      { originalText: '1 can diced tomatoes, 14 oz' },
      { originalText: '6 cups chicken broth' },
      { originalText: '1 can black beans, drained and rinsed' },
      { originalText: '1 cup corn kernels' },
      { originalText: '2 teaspoons cumin' },
      { originalText: '1 teaspoon chili powder' },
      { originalText: '1 teaspoon smoked paprika' },
      { originalText: '1 lime, juiced' },
      { originalText: 'salt and pepper to taste' },
      // Tortilla strips section
      { title: 'For the Tortilla Strips' },
      { originalText: '6 corn tortillas' },
      { originalText: '2 tablespoons vegetable oil' },
      { originalText: '1/2 teaspoon salt' },
      // Toppings section
      { title: 'For Serving' },
      { originalText: '1 avocado, diced' },
      { originalText: '1/2 cup sour cream' },
      { originalText: '1/2 cup fresh cilantro, chopped' },
      { originalText: '1 cup shredded cheese, Mexican blend' },
      { originalText: 'lime wedges' },
    ],
    recipeInstructions: [
      {
        title: 'Make the Soup',
        text: 'Heat olive oil in a large pot over medium-high heat. Season chicken with salt, pepper, and half the cumin. Cook chicken until golden and cooked through, about 6-7 minutes per side. Remove and set aside.',
      },
      {
        text: 'In the same pot, sauté onion until softened, about 5 minutes. Add garlic and jalapeño, cook for 1 minute until fragrant.',
      },
      {
        text: 'Add diced tomatoes, chicken broth, black beans, corn, remaining cumin, chili powder, and smoked paprika. Bring to a boil, then reduce heat and simmer for 15 minutes.',
      },
      {
        text: 'Shred the cooked chicken and add it back to the pot. Simmer for another 5 minutes. Stir in lime juice and season with salt and pepper to taste.',
      },
      {
        title: 'Make the Tortilla Strips',
        text: 'While soup simmers, cut corn tortillas into thin strips about 1/4 inch wide.',
      },
      {
        text: 'Heat vegetable oil in a skillet over medium-high heat. Fry tortilla strips in batches until golden and crispy, about 2-3 minutes. Transfer to a paper towel-lined plate and season with salt.',
      },
      {
        title: 'Serve',
        text: 'Ladle soup into bowls. Top with crispy tortilla strips, diced avocado, sour cream, shredded cheese, and fresh cilantro. Serve with lime wedges on the side.',
      },
    ],
  });

  console.log('Created:', slug);

  const recipe = await api.getRecipe(slug);
  console.log('\n=== ' + recipe.name + ' ===\n');

  console.log('INGREDIENTS:');
  let currentSection = '';
  for (const ing of recipe.recipeIngredient || []) {
    if (ing.title && ing.title !== currentSection) {
      currentSection = ing.title;
      console.log('\n' + ing.title);
      continue;
    }
    if (ing.title) continue; // Skip section headers after printing
    const qty = ing.quantity || '';
    const unit = ing.unit?.name || '';
    const food = ing.food?.name || '';
    const note = ing.note ? '(' + ing.note + ')' : '';
    console.log('  •', [qty, unit, food, note].filter(Boolean).join(' '));
  }

  console.log('\n\nINSTRUCTIONS:');
  let step = 1;
  for (const inst of recipe.recipeInstructions || []) {
    if (inst.title) {
      console.log('\n--- ' + inst.title + ' ---');
    }
    console.log(step + '.', inst.text);
    step++;
  }
}

createSoup().catch(console.error);
