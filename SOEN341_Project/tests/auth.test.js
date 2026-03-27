import { test, expect } from '@playwright/test';

// Generate a unique email each test run so there's no conflict
const testEmail = `testuser_${Date.now()}@school.ca`;
const testPassword = 'Test1234';

test('User can register and then login with the same credentials', async ({ page }) => {

  // Go to register page
  await page.goto('http://localhost:3000/register');

  // Fill in register form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.fill('input[name="ConfirmPassword"]', testPassword);

  // Submit the form
  await page.click('button[type="submit"]');

  // Verify registration was successful (redirected to /login)
  await expect(page).toHaveURL('http://localhost:3000/login');

  // Fill in login form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit the form
  await page.click('button[type="submit"]');

  // Verify redirected to onboarding (new users need to complete setup)
  await expect(page).toHaveURL(/\/onboarding/);

  // Complete onboarding - Step 1: Skip allergies
  await page.click('#none-allergies-btn');

  // Step 2: Select a diet (wait for slide to be visible)
  await page.waitForSelector('#slide-1.active');
  await page.click('.diet-card[data-value="Balanced"]');
  await page.click('#next-1');

  // Step 3: Submit onboarding (wait for final slide)
  await page.waitForSelector('#slide-2.active');
  await page.click('button.onb-submit-btn');

  // Verify we reached the dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  
  // Verify dashboard content is visible (greeting text)
  await expect(page.locator('text=/Good (morning|afternoon|evening)/')).toBeVisible();
});