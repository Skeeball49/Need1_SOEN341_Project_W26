import { test, expect } from '@playwright/test';

const testPassword = 'Test1234';

async function registerAndLogin(page, email) {
  await page.goto('http://localhost:3000/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', testPassword);
  await page.fill('input[name="ConfirmPassword"]', testPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('http://localhost:3000/login');

  await page.fill('input[name="email"]', email);
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

test('User can search recipes by name (RM-5)', async ({ page }) => {
  const email = `rm5user_${Date.now()}@school.ca`;
  await registerAndLogin(page, email);

  // Create a recipe with a fully unique title (timestamp ensures no collisions with old test data)
  const uniqueTitle = `SearchTest_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', uniqueTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '200g Chicken\n1 cup Rice';
  });
  await page.fill('textarea[name="steps"]', 'Cook chicken. Serve with rice.');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  // Wait for all cards to finish loading/animating
  await page.waitForLoadState('networkidle');

  const searchInput = page.locator('#rc-search');
  await expect(searchInput).toBeVisible();

  // Search using the full unique title — timestamp makes it truly unique in the DB
  await searchInput.fill(uniqueTitle.toLowerCase());

  // Our recipe must appear in results
  await expect(page.locator(`.rc-card[data-title="${uniqueTitle.toLowerCase()}"]`)).toBeVisible();

  // Empty state: search for something that cannot exist
  await searchInput.fill('xyznosuchrecipe999abc');
  await expect(page.locator('#rc-empty')).toBeVisible();

  // Clear — cards should return
  await page.click('#rc-search-clear');
  await expect(page.locator('#rc-empty')).not.toBeVisible();
  await expect(page.locator('.rc-card').first()).toBeVisible();
});

test('User can filter recipes by category/tag (RM-6)', async ({ page }) => {
  const email = `rm6user_${Date.now()}@school.ca`;
  await registerAndLogin(page, email);

  // Create a recipe tagged under Breakfast category
  const uniqueTitle = `BreakfastDish_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', uniqueTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '1 cup Oats\n1 cup Almond Milk';
  });
  await page.fill('textarea[name="steps"]', 'Mix and serve.');

  // Select Breakfast as the category
  await page.selectOption('select[name="category"]', 'Breakfast');

  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  await page.waitForLoadState('networkidle');

  // Get total card count before filtering
  const allCards = page.locator('.rc-card');
  const totalCount = await allCards.count();
  expect(totalCount).toBeGreaterThan(0);

  // Click the Breakfast filter button (matches actual UI text)
  await page.getByText('🍳 Breakfast').click();
  await page.waitForLoadState('networkidle');

  // Our newly created breakfast recipe should be visible
  await expect(page.getByText(uniqueTitle)).toBeVisible();

  // Empty state should NOT be showing
  await expect(page.locator('#rc-empty')).not.toBeVisible();

  // Click "All" to restore all cards
  await page.getByText('All').click();
  await page.waitForLoadState('networkidle');
  const restoredCount = await page.locator('.rc-card:visible').count();
  expect(restoredCount).toBe(totalCount);
});
