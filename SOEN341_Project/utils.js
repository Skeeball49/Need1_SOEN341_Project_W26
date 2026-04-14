// utils.js — Pure helper functions extracted from index.js
// These functions contain no Express/Supabase dependencies and are fully unit-testable.

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday of the given date's week.
 * Accepts an optional date so tests can pass a fixed date without mocking Date.
 * @param {Date} [date=new Date()]
 * @returns {string} e.g. "2026-04-13"
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

/**
 * Parses a raw ingredient string (e.g. "2 cups flour") into { qty, name }.
 * Falls back to { qty: 1, name: raw } when no leading number is found.
 * @param {string} raw
 * @returns {{ qty: number, name: string }}
 */
export function parseIngredient(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (match) {
    return { qty: parseFloat(match[1]), name: match[2].toLowerCase().trim() };
  }
  return { qty: 1, name: trimmed.toLowerCase().trim() };
}

/**
 * Auto-categorizes an ingredient name into one of: Dairy, Meat, Produce, Grains, Other.
 * @param {string} name
 * @returns {string}
 */
export function categorizeIngredient(name) {
  const n = name.toLowerCase();
  if (n.includes("milk") || n.includes("cheese") || n.includes("yogurt") || n.includes("butter")) return "Dairy";
  if (n.includes("chicken") || n.includes("beef") || n.includes("pork") || n.includes("fish")) return "Meat";
  if (n.includes("apple") || n.includes("banana") || n.includes("lettuce") || n.includes("tomato")) return "Produce";
  if (n.includes("rice") || n.includes("pasta") || n.includes("bread") || n.includes("flour")) return "Grains";
  return "Other";
}

/**
 * Consolidates ingredients across multiple recipes, subtracts pantry quantities,
 * and returns items that still need to be bought.
 *
 * @param {Array<{ingredients: string[], cost: number}>} recipes
 * @param {Array<{ingredient_name: string, quantity: number, category?: string}>} pantryItems
 * @returns {{ groceryList: Array, totalCost: number }}
 */
export function consolidateIngredients(recipes, pantryItems = []) {
  const pantryMap = {};
  for (const item of pantryItems) {
    pantryMap[item.ingredient_name.toLowerCase().trim()] = Number(item.quantity || 0);
  }

  const ingredientMap = {};
  let totalCost = 0;

  for (const recipe of recipes) {
    totalCost += Number(recipe.cost || 0);
    for (const raw of recipe.ingredients || []) {
      const { qty, name } = parseIngredient(raw);
      ingredientMap[name] = (ingredientMap[name] || 0) + qty;
    }
  }

  const groceryList = Object.entries(ingredientMap)
    .map(([name, needed]) => {
      const inPantry = pantryMap[name] || 0;
      const toBuy = Math.max(0, needed - inPantry);

      let category = "Other";
      const pantryItem = pantryItems.find(p => p.ingredient_name.toLowerCase() === name);
      if (pantryItem && pantryItem.category) {
        category = pantryItem.category;
      } else {
        category = categorizeIngredient(name);
      }

      return { name, needed, inPantry, toBuy, category };
    })
    .filter(item => item.toBuy > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { groceryList, totalCost };
}

/**
 * Calculates the match percentage between a recipe's ingredients and the user's pantry.
 * Uses partial string matching (e.g. "chicken" matches "chicken breast").
 *
 * @param {{ ingredients: string[] }} recipe
 * @param {string[]} pantryIngredients  — already-lowercased ingredient names
 * @returns {number} 0–100
 */
export function calculateMatchPercentage(recipe, pantryIngredients) {
  const recipeIngredients = (recipe.ingredients || []).map(ing => parseIngredient(ing).name);

  if (recipeIngredients.length === 0) return 0;

  const matched = recipeIngredients.filter(ing =>
    pantryIngredients.some(p => ing.includes(p) || p.includes(ing))
  );

  return Math.round((matched.length / recipeIngredients.length) * 100);
}

/**
 * Calculates per-day calorie/macro totals from a meal plan.
 *
 * @param {Array<{day: string, recipe_id: number}>} planEntries
 * @param {Object} recipeMap  — { [id]: { calories, protein, carbs, fat } }
 * @param {string[]} days     — ordered day names
 * @returns {Array<{day: string, calories: number, protein: number, carbs: number, fat: number}>}
 */
export function calculateDailyBreakdown(planEntries, recipeMap, days) {
  return days.map(day => {
    const dayEntries = planEntries.filter(e => e.day === day);
    let calories = 0, protein = 0, carbs = 0, fat = 0;

    for (const entry of dayEntries) {
      const recipe = recipeMap[entry.recipe_id];
      if (recipe) {
        calories += Number(recipe.calories || 0);
        protein  += Number(recipe.protein  || 0);
        carbs    += Number(recipe.carbs    || 0);
        fat      += Number(recipe.fat      || 0);
      }
    }

    return { day, calories, protein, carbs, fat };
  });
}

/**
 * Sums a daily breakdown array into a single weekly-totals object.
 *
 * @param {Array<{calories: number, protein: number, carbs: number, fat: number}>} dailyBreakdown
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
export function calculateWeeklyStats(dailyBreakdown) {
  return dailyBreakdown.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      protein:  acc.protein  + day.protein,
      carbs:    acc.carbs    + day.carbs,
      fat:      acc.fat      + day.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Builds a recipe object from raw form-body data.
 * Handles type coercions and default values so the route stays clean.
 *
 * @param {Object} body  — req.body from the recipe create/update form
 * @returns {Object}
 */
export function buildRecipeObject(body) {
  const {
    title, ingredients, prepTime, steps, cost,
    difficulty, tags, servings, calories, protein, carbs, fat, category
  } = body;

  return {
    title:       title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime:    Number(prepTime   || 0),
    steps:       steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost:        Number(cost       || 0),
    difficulty:  difficulty || "Easy",
    tags:        (tags || "").split(",").map(s => s.trim()).filter(Boolean),
    servings:    Number(servings   || 4),
    calories:    Number(calories   || 0),
    protein:     Number(protein    || 0),
    carbs:       Number(carbs      || 0),
    fat:         Number(fat        || 0),
    category:    category || "Main Course",
  };
}

/**
 * Scales a single raw ingredient string by the given factor.
 * e.g. scaleIngredient("2 cups flour", 1.5) → "3.0 cups flour"
 *
 * @param {string} raw
 * @param {number} scale
 * @returns {string}
 */
export function scaleIngredient(raw, scale) {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (match) {
    const qty = parseFloat(match[1]) * scale;
    return `${qty.toFixed(1)} ${match[2]}`;
  }
  return raw;
}

/**
 * Validates registration form input.
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validateRegistration(email, password, confirmPassword) {
  if (!email || !password || !confirmPassword) {
    return { valid: false, error: "Please fill in all fields." };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match." };
  }
  return { valid: true };
}

/**
 * Validates a password-change request.
 * @param {{ password: string }|null} user   — the loaded user object
 * @param {string} currentPassword
 * @param {string} newPassword
 * @param {string} confirmPassword
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validatePasswordChange(user, currentPassword, newPassword, confirmPassword) {
  if (!user || user.password !== currentPassword) {
    return { valid: false, error: "Current password is incorrect." };
  }
  if (!newPassword || newPassword !== confirmPassword) {
    return { valid: false, error: "New passwords do not match." };
  }
  return { valid: true };
}
