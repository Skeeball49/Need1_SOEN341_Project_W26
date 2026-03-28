import { test, expect } from '@playwright/test';

const BASE_EMAIL = 'test@gmail.com';
const BASE_URL = `https://need1.netlify.app`;

// Hardcoded recipe: "Avocado Toast with Egg"
const RECIPE_ID = 'a0fdc0ea-5967-486c-9317-02a8ce67b63b';

test('User can find a recipe, add an ingredient, and save changes', async ({ page }) => {
  // Navigate directly to the dashboard as the logged-in user
  await page.goto(`${BASE_URL}/dashboard?email=${encodeURIComponent(BASE_EMAIL)}`);

  // Click the Recipes link in the nav
  await page.click('a[href*="/recipes"]');

  // Verify we are on the recipes page
  await expect(page).toHaveURL(`${BASE_URL}/recipes?email=${encodeURIComponent(BASE_EMAIL)}`);

  // Click the Edit button for "Avocado Toast with Egg" (hardcoded recipe)
  await page.click(`a[href*="${RECIPE_ID}/edit"]`);

  // Verify we are on the edit page
  await expect(page).toHaveURL(new RegExp(`${RECIPE_ID}/edit`));
  await expect(page.locator('h1')).toHaveText('Edit Recipe');

  // Type a new ingredient name into the text input and click Add
  const ingredientInput = page.locator('input[placeholder*="Add"], input[type="text"]').first();
  await ingredientInput.fill('Spinach');
  await page.click('button:has-text("Add")');

  // Click Save Changes
  await page.click('button:has-text("Save Changes")');

  // Verify we are redirected back to the recipes page after saving
  await expect(page).toHaveURL(`${BASE_URL}/recipes?email=${encodeURIComponent(BASE_EMAIL)}`);
});
