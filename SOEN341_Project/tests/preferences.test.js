import { test, expect } from '@playwright/test';

// Generate a unique email so it doesn't conflict
const testEmail = `prefuser_${Date.now()}@school.ca`;
const testPassword = 'Test1234';

test('User can login and update dietary preferences', async ({ page }) => {

  // Register the account first
  await page.goto('http://localhost:3000/register');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.fill('input[name="ConfirmPassword"]', testPassword);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL('http://localhost:3000/register');

  // Go to home page
  await page.goto('http://localhost:3000/');

  // Click "Get Started" button
  await page.click('a[href="/register"]:has-text("Get started")');

  // Since we already have an account, click "I already have an account"
  await page.click('a[href="/login"]');

  // Fill in login form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit login form
  await page.click('button[type="submit"]');

  // Verify we are on the dashboard
  await expect(page).toHaveURL('http://localhost:3000/dashboard');

  // Select a diet from the dropdown
  await page.selectOption('select[name="diet"]', 'Vegan');

  // Type allergies separated by commas
  await page.fill('input[name="allergies"]', 'Peanuts, Shellfish, Dairy');

  // Click "Update Preferences"
  await page.click('button[type="submit"]');

  // Verify preferences were saved
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
  await expect(page.locator('text=Vegan')).toBeVisible();
  await expect(page.locator('text=Peanuts, Shellfish, Dairy')).toBeVisible();
});