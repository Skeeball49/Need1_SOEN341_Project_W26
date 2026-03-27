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

  // Create a recipe with a vegan tag
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', `VeganDish_${Date.now()}`);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '1 cup Chickpeas\n2 tbsp Olive Oil';
  });
  await page.fill('textarea[name="steps"]', 'Mix and serve.');

  // Click "Cost & Tags" tab to reveal the tags input
  await page.click('.rf-meta-tab[data-panel="cost"]');
  await expect(page.locator('#rf-panel-cost')).toBeVisible();
  await page.fill('input[name="tags"]', 'vegan');

  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  await page.waitForLoadState('networkidle');

  // Get total card count with "All" filter active
  const allCards = page.locator('.rc-card');
  const totalCount = await allCards.count();
  expect(totalCount).toBeGreaterThan(0);

  // Apply vegan filter
  await page.click('.chip[data-filter="vegan"]');

  // Vegan-tagged cards should be visible and empty state should not show
  await expect(page.locator('.rc-card[data-tags*="vegan"]').first()).toBeVisible();
  await expect(page.locator('#rc-empty')).not.toBeVisible();

  // Click "All" — all cards restored
  await page.click('.chip[data-filter="all"]');
  const restoredCount = await page.locator('.rc-card:visible').count();
  expect(restoredCount).toBe(totalCount);
});
