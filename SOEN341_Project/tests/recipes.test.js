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

  // Create a uniquely named recipe
  const uniqueTitle = `ZestyLemonChicken_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', uniqueTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '200g Chicken\n1 cup Rice';
  });
  await page.fill('textarea[name="steps"]', 'Cook chicken.\nServe with rice.');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  // Search for our recipe by name
  const searchInput = page.locator('#rc-search');
  await expect(searchInput).toBeVisible();
  await searchInput.fill(uniqueTitle.toLowerCase().slice(0, 10));

  const matchingCards = page.locator('.rc-card:visible');
  await expect(matchingCards).toHaveCount(1);
  await expect(page.locator('.rc-card:visible .rc-card-name')).toContainText(uniqueTitle);

  // Search for something that won't match — empty state should appear
  await searchInput.fill('xyznosuchrecipe999');
  await expect(page.locator('#rc-empty')).toBeVisible();
  await expect(page.locator('.rc-card:visible')).toHaveCount(0);

  // Clear the search — cards should return
  await page.click('#rc-search-clear');
  await expect(page.locator('#rc-empty')).not.toBeVisible();
  await expect(page.locator('.rc-card:visible').first()).toBeVisible();
});

test('User can filter recipes by category/tag (RM-6)', async ({ page }) => {
  const email = `rm6user_${Date.now()}@school.ca`;
  await registerAndLogin(page, email);

  // Create a vegan-tagged recipe
  const veganTitle = `VeganTestDish_${Date.now()}`;
  await page.goto(`http://localhost:3000/recipes/new?email=${encodeURIComponent(email)}`);
  await page.fill('input[name="title"]', veganTitle);
  await page.locator('textarea[name="ingredients"]').evaluate((el) => {
    el.value = '1 cup Chickpeas\n2 tbsp Olive Oil';
  });
  await page.fill('textarea[name="steps"]', 'Mix and serve.');
  await page.fill('input[name="tags"]', 'vegan');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/recipes/);

  // Apply the Vegan filter
  await page.goto(`http://localhost:3000/recipes?email=${encodeURIComponent(email)}`);
  await page.click('.chip[data-filter="vegan"]');

  // Vegan-tagged cards should be visible
  const visibleCards = page.locator('.rc-card:visible');
  const count = await visibleCards.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('#rc-empty')).not.toBeVisible();

  // Click "All" — should show equal or more cards
  await page.click('.chip[data-filter="all"]');
  const allCount = await page.locator('.rc-card:visible').count();
  expect(allCount).toBeGreaterThanOrEqual(count);
});
