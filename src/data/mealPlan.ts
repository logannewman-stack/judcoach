import type { MealPlan } from '../domain/types'

/**
 * Jud's plan for this client. Every meal's macros are real and the meals sum
 * exactly to the training-day targets, so the rings close when the plan is
 * followed. Swaps are macro-matched within ~40 kcal / 6 g protein.
 */
export const MEAL_PLAN: MealPlan = {
  id: 'plan-block-3',
  name: 'Block 3 Fuelling',
  subtitle: 'High-protein · carbs cycled around training',
  targets: { kcal: 2920, protein: 247, carbs: 283, fat: 89, fiber: 32, waterOz: 128 },
  restDayTargets: { kcal: 2570, protein: 247, carbs: 195, fat: 89, fiber: 26, waterOz: 120 },
  // How the rest-day carb cut is actually served. Protein and fat foods are
  // untouched; the reduction comes entirely out of the starch anchors.
  restDayPortions: {
    'm1-oats': 0.75,
    'm2-honey': 0.5,
    'm3-rice': 0.5,
    'm4-ricecakes': 0.5,
    'm5-potato': 0.5,
  },
  guidelines: [
    'Protein is the non-negotiable. Hit 247 g even on a day the rest falls apart.',
    'Carbs sit around training — meal 4 and meal 5 do the heavy lifting.',
    'Rest days drop ~90 g of carbs. Protein and fat stay identical.',
    'Two fists of vegetables at lunch and dinner, every day.',
    'Stop eating three hours before bed where you can. Meal 6 is the exception.',
    'One free meal a week. Log it, do not hide it — it tells me what to adjust.',
  ],
  meals: [
    {
      id: 'meal-1',
      name: 'Breakfast',
      time: '07:00',
      note: 'Eat within an hour of waking.',
      items: [
        {
          id: 'm1-eggs',
          name: 'Whole eggs',
          qty: 3,
          unit: 'large',
          kcal: 210, protein: 18, carbs: 1, fat: 15,
          swaps: [
            { id: 'm1-eggs-s1', name: 'Turkey sausage', qty: 100, unit: 'g', kcal: 196, protein: 19, carbs: 2, fat: 12 },
            { id: 'm1-eggs-s2', name: 'Smoked salmon', qty: 100, unit: 'g', kcal: 180, protein: 20, carbs: 0, fat: 11 },
          ],
        },
        {
          id: 'm1-whites',
          name: 'Egg whites',
          qty: 150,
          unit: 'g',
          kcal: 80, protein: 16, carbs: 2, fat: 0,
          swaps: [
            { id: 'm1-whites-s1', name: 'Whey isolate', qty: 20, unit: 'g', kcal: 78, protein: 17, carbs: 1, fat: 0 },
          ],
        },
        {
          id: 'm1-oats',
          name: 'Rolled oats (dry)',
          qty: 60,
          unit: 'g',
          kcal: 228, protein: 8, carbs: 41, fat: 4, fiber: 6,
          swaps: [
            { id: 'm1-oats-s1', name: 'Cream of rice (dry)', qty: 55, unit: 'g', kcal: 200, protein: 4, carbs: 44, fat: 1 },
            { id: 'm1-oats-s2', name: 'Ezekiel bread', qty: 3, unit: 'slices', kcal: 240, protein: 12, carbs: 45, fat: 2 },
          ],
        },
        {
          id: 'm1-berries',
          name: 'Blueberries',
          qty: 100,
          unit: 'g',
          kcal: 57, protein: 1, carbs: 14, fat: 0, fiber: 2.4,
          swaps: [
            { id: 'm1-berries-s1', name: 'Strawberries', qty: 150, unit: 'g', kcal: 48, protein: 1, carbs: 11, fat: 0 },
            { id: 'm1-berries-s2', name: 'Banana', qty: 0.5, unit: 'medium', kcal: 56, protein: 1, carbs: 14, fat: 0 },
          ],
        },
      ],
    },
    {
      id: 'meal-2',
      name: 'Mid-morning',
      time: '10:30',
      items: [
        {
          id: 'm2-yogurt',
          name: 'Greek yogurt, 0%',
          qty: 200,
          unit: 'g',
          kcal: 108, protein: 20, carbs: 7, fat: 0,
          swaps: [
            { id: 'm2-yogurt-s1', name: 'Skyr', qty: 175, unit: 'g', kcal: 112, protein: 20, carbs: 6, fat: 0 },
            { id: 'm2-yogurt-s2', name: 'Cottage cheese, 1%', qty: 150, unit: 'g', kcal: 120, protein: 20, carbs: 5, fat: 2 },
          ],
        },
        { id: 'm2-honey', name: 'Honey', qty: 20, unit: 'g', kcal: 68, protein: 0, carbs: 17, fat: 0 },
        {
          id: 'm2-almonds',
          name: 'Almonds',
          qty: 20,
          unit: 'g',
          kcal: 122, protein: 4, carbs: 4, fat: 10, fiber: 2.5,
          swaps: [
            { id: 'm2-almonds-s1', name: 'Walnuts', qty: 18, unit: 'g', kcal: 118, protein: 3, carbs: 2, fat: 12 },
            { id: 'm2-almonds-s2', name: 'Peanut butter', qty: 18, unit: 'g', kcal: 112, protein: 5, carbs: 4, fat: 9 },
          ],
        },
      ],
    },
    {
      id: 'meal-3',
      name: 'Lunch',
      time: '13:00',
      note: 'Two fists of vegetables minimum.',
      items: [
        {
          id: 'm3-chicken',
          name: 'Chicken breast (cooked)',
          qty: 175,
          unit: 'g',
          kcal: 279, protein: 54, carbs: 0, fat: 7,
          swaps: [
            { id: 'm3-chicken-s1', name: 'Turkey breast', qty: 180, unit: 'g', kcal: 268, protein: 55, carbs: 0, fat: 5 },
            { id: 'm3-chicken-s2', name: 'Cod or tilapia', qty: 230, unit: 'g', kcal: 250, protein: 53, carbs: 0, fat: 3 },
            { id: 'm3-chicken-s3', name: '93% lean beef', qty: 150, unit: 'g', kcal: 285, protein: 48, carbs: 0, fat: 10 },
          ],
        },
        {
          id: 'm3-rice',
          name: 'Jasmine rice (cooked)',
          qty: 200,
          unit: 'g',
          kcal: 257, protein: 5, carbs: 57, fat: 1, fiber: 0.6,
          swaps: [
            { id: 'm3-rice-s1', name: 'White potato', qty: 290, unit: 'g', kcal: 252, protein: 6, carbs: 55, fat: 0 },
            { id: 'm3-rice-s2', name: 'Sweet potato', qty: 300, unit: 'g', kcal: 258, protein: 5, carbs: 58, fat: 0 },
            { id: 'm3-rice-s3', name: 'Pasta (cooked)', qty: 165, unit: 'g', kcal: 254, protein: 9, carbs: 51, fat: 1 },
          ],
        },
        { id: 'm3-broccoli', name: 'Broccoli', qty: 200, unit: 'g', kcal: 73, protein: 6, carbs: 10, fat: 1, fiber: 5.2 },
        { id: 'm3-oil', name: 'Olive oil', qty: 10, unit: 'g', kcal: 90, protein: 0, carbs: 0, fat: 10 },
      ],
    },
    {
      id: 'meal-4',
      name: 'Pre-training',
      time: '16:30',
      note: '60–90 minutes before you lift.',
      items: [
        {
          id: 'm4-ricecakes',
          name: 'Rice cakes',
          qty: 4,
          unit: 'cakes',
          kcal: 141, protein: 3, carbs: 30, fat: 1, fiber: 1.2,
          swaps: [
            { id: 'm4-ricecakes-s1', name: 'Bagel, plain', qty: 0.6, unit: 'bagel', kcal: 145, protein: 5, carbs: 29, fat: 1 },
            { id: 'm4-ricecakes-s2', name: 'Cream of rice (dry)', qty: 38, unit: 'g', kcal: 138, protein: 3, carbs: 31, fat: 0 },
          ],
        },
        { id: 'm4-banana', name: 'Banana', qty: 1, unit: 'medium', kcal: 112, protein: 1, carbs: 27, fat: 0, fiber: 3.1 },
        {
          id: 'm4-whey',
          name: 'Whey protein',
          qty: 1,
          unit: 'scoop',
          kcal: 130, protein: 25, carbs: 3, fat: 2,
          swaps: [
            { id: 'm4-whey-s1', name: 'Chicken breast', qty: 90, unit: 'g', kcal: 143, protein: 28, carbs: 0, fat: 3 },
          ],
        },
      ],
    },
    {
      id: 'meal-5',
      name: 'Dinner',
      time: '19:30',
      note: 'Post-training. Biggest carb feed of the day.',
      items: [
        {
          id: 'm5-steak',
          name: 'Sirloin steak (cooked)',
          qty: 170,
          unit: 'g',
          kcal: 318, protein: 48, carbs: 0, fat: 14,
          swaps: [
            { id: 'm5-steak-s1', name: 'Salmon fillet', qty: 165, unit: 'g', kcal: 336, protein: 42, carbs: 0, fat: 19 },
            { id: 'm5-steak-s2', name: 'Chicken thigh, skinless', qty: 190, unit: 'g', kcal: 323, protein: 47, carbs: 0, fat: 15 },
            { id: 'm5-steak-s3', name: '93% lean beef', qty: 170, unit: 'g', kcal: 323, protein: 54, carbs: 0, fat: 11 },
          ],
        },
        {
          id: 'm5-potato',
          name: 'Roast potatoes',
          qty: 300,
          unit: 'g',
          kcal: 263, protein: 6, carbs: 53, fat: 3, fiber: 6.3,
          swaps: [
            { id: 'm5-potato-s1', name: 'White rice (cooked)', qty: 205, unit: 'g', kcal: 265, protein: 5, carbs: 58, fat: 1 },
            { id: 'm5-potato-s2', name: 'Sourdough bread', qty: 100, unit: 'g', kcal: 260, protein: 9, carbs: 50, fat: 2 },
          ],
        },
        { id: 'm5-salad', name: 'Green salad + dressing', qty: 1, unit: 'bowl', kcal: 122, protein: 2, carbs: 6, fat: 10, fiber: 3 },
      ],
    },
    {
      id: 'meal-6',
      name: 'Before bed',
      time: '21:30',
      note: 'Slow protein overnight.',
      items: [
        {
          id: 'm6-cottage',
          name: 'Cottage cheese, low fat',
          qty: 200,
          unit: 'g',
          kcal: 163, protein: 26, carbs: 8, fat: 3,
          swaps: [
            { id: 'm6-cottage-s1', name: 'Casein shake', qty: 1, unit: 'scoop', kcal: 130, protein: 25, carbs: 4, fat: 1 },
            { id: 'm6-cottage-s2', name: 'Greek yogurt, 2%', qty: 200, unit: 'g', kcal: 168, protein: 24, carbs: 9, fat: 4 },
          ],
        },
        { id: 'm6-pb', name: 'Peanut butter', qty: 16, unit: 'g', kcal: 100, protein: 4, carbs: 3, fat: 8, fiber: 1.3 },
      ],
    },
  ],
}

/** Handy extras the client can add in one tap. */
export const QUICK_ADDS = [
  { id: 'qa-whey', name: 'Whey scoop', qty: 1, unit: 'scoop', kcal: 130, protein: 25, carbs: 3, fat: 2 },
  { id: 'qa-banana', name: 'Banana', qty: 1, unit: 'medium', kcal: 112, protein: 1, carbs: 27, fat: 0 },
  { id: 'qa-chicken', name: 'Chicken breast 100g', qty: 100, unit: 'g', kcal: 159, protein: 31, carbs: 0, fat: 4 },
  { id: 'qa-rice', name: 'Rice 100g cooked', qty: 100, unit: 'g', kcal: 129, protein: 3, carbs: 28, fat: 0 },
  { id: 'qa-pb', name: 'Peanut butter 16g', qty: 16, unit: 'g', kcal: 100, protein: 4, carbs: 3, fat: 8 },
  { id: 'qa-coffee', name: 'Coffee, black', qty: 1, unit: 'cup', kcal: 2, protein: 0, carbs: 0, fat: 0 },
  { id: 'qa-beer', name: 'Beer', qty: 1, unit: 'can', kcal: 153, protein: 2, carbs: 13, fat: 0 },
  { id: 'qa-pizza', name: 'Pizza slice', qty: 1, unit: 'slice', kcal: 285, protein: 12, carbs: 36, fat: 10 },
]
