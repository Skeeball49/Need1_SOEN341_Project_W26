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

  const uniqueTitle = `SearchTest_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', uniqueTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '200g Chicken\n1 cup Rice';
  });
  await page.fill('textarea[name="steps"]', 'Cook chicken. Serve with rice.');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  await page.waitForLoadState('networkidle');

  const searchInput = page.locator('#rc-search');
  await expect(searchInput).toBeVisible();

  await searchInput.fill(uniqueTitle.toLowerCase());
  await expect(page.locator(`.rc-card[data-title="${uniqueTitle.toLowerCase()}"]`)).toBeVisible();

  await searchInput.fill('xyznosuchrecipe999abc');
  await expect(page.locator('#rc-empty')).toBeVisible();

  await page.click('#rc-search-clear');
  await expect(page.locator('#rc-empty')).not.toBeVisible();
  await expect(page.locator('.rc-card').first()).toBeVisible();
});

test('User can filter recipes by category/tag (RM-6)', async ({ page }) => {
  const email = `rm6user_${Date.now()}@school.ca`;
  await registerAndLogin(page, email);

  const uniqueTitle = `BreakfastDish_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', uniqueTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '1 cup Oats\n1 cup Almond Milk';
  });
  await page.fill('textarea[name="steps"]', 'Mix and serve.');
  await page.selectOption('select[name="category"]', 'Breakfast');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  await page.waitForLoadState('networkidle');

  const allCards = page.locator('.rc-card');
  const totalCount = await allCards.count();
  expect(totalCount).toBeGreaterThan(0);

  await page.getByRole('button', { name: '🍳 Breakfast' }).click();
  await page.waitForLoadState('networkidle');

  await expect(page.locator(`.rc-card[data-title="${uniqueTitle.toLowerCase()}"]`)).toBeVisible();
  await expect(page.locator('#rc-empty')).not.toBeVisible();

  await page.getByRole('button', { name: 'All' }).click();
  await page.waitForLoadState('networkidle');
  const restoredCount = await page.locator('.rc-card:visible').count();
  expect(restoredCount).toBe(totalCount);
});
