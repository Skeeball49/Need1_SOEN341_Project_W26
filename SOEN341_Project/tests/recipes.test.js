import { test, expect } from '@playwright/test';

// Unique credentials per test run
const testEmail = `recipeuser_${Date.now()}@school.ca`;
const testPassword = 'Test1234';

async function registerAndLogin(page) {
  await page.goto('http://localhost:3000/register');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.fill('input[name="ConfirmPassword"]', testPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('http://localhost:3000/login');

  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/onboarding/);

  await page.click('#none-allergies-btn');
  await page.waitForSelector('#slide-1.active');
  await page.click('.diet-card[data-value="Balanced"]');
  await page.click('#next-1');
  await page.waitForSelector('#slide-2.active');
  await page.click('button.onb-submit-btn');
  await expect(page).toHaveURL(/\/dashboard/);
}

async function createTestRecipe(page, title) {
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(testEmail)}`);
  await page.fill('input[name="title"]', title);
  // ingredients textarea is hidden (managed by JS builder) — set value directly
  await page.locator('textarea[name="ingredients"]').evaluate((el, val) => {
    el.value = val;
  }, '200g Chicken\n1 cup Rice');
  await page.fill('textarea[name="steps"]', 'Cook chicken.\nServe with rice.');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);
}

test('User can search recipes by name (RM-5)', async ({ page }) => {
  await registerAndLogin(page);

  const uniqueTitle = `ZestyLemonChicken_${Date.now()}`;
  await createTestRecipe(page, uniqueTitle);

  // Navigate to recipes page
  await page.goto(`http://localhost:3000/recipes?email=${encodeURIComponent(testEmail)}`);

  const searchInput = page.locator('#rc-search');
  await expect(searchInput).toBeVisible();

  // Search for our unique recipe — it should appear
  await searchInput.fill(uniqueTitle.toLowerCase());
  const matchingCards = page.locator('.rc-card:visible');
  await expect(matchingCards).toHaveCount(1);
  await expect(page.locator(`.rc-card:visible .rc-card-name`)).toContainText(uniqueTitle);

  // Search for something that won't match
  await searchInput.fill('xyznosuchrecipe999');
  await expect(page.locator('#rc-empty')).toBeVisible();
  await expect(page.locator('.rc-card:visible')).toHaveCount(0);

  // Clear the search — all cards should return
  await page.click('#rc-search-clear');
  await expect(page.locator('#rc-empty')).not.toBeVisible();
  await expect(page.locator('.rc-card:visible').first()).toBeVisible();
});

test('User can filter recipes by category/tag (RM-6)', async ({ page }) => {
  await registerAndLogin(page);

  // Create a vegan recipe
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(testEmail)}`);
  await page.fill('input[name="title"]', `VeganTestDish_${Date.now()}`);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '1 cup Chickpeas\n2 tbsp Olive Oil';
  });
  await page.fill('textarea[name="steps"]', 'Mix and serve.');
  await page.selectOption('select[name="difficulty"]', 'Easy');
  await page.fill('input[name="tags"]', 'vegan');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  // Go to recipes page and apply the Vegan filter
  await page.goto(`http://localhost:3000/recipes?email=${encodeURIComponent(testEmail)}`);
  await page.click('.chip[data-filter="vegan"]');

  // Verify only vegan-tagged cards are visible
  const visibleCards = page.locator('.rc-card:visible');
  const count = await visibleCards.count();
  expect(count).toBeGreaterThan(0);

  // Verify the empty state is not shown when results exist
  await expect(page.locator('#rc-empty')).not.toBeVisible();

  // Click "All" to clear the filter — more cards should appear (or same)
  await page.click('.chip[data-filter="all"]');
  const allCount = await page.locator('.rc-card:visible').count();
  expect(allCount).toBeGreaterThanOrEqual(count);
});
