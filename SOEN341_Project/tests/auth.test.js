import { test, expect } from '@playwright/test';

// Generate a unique email each test run so there's no conflict
const testEmail = `prefuser_${Date.now()}@school.ca`;
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
  await expect(page).not.toHaveURL('http://localhost:3000/register');

  // Go to login page
  await page.goto('http://localhost:3000/login');

  // Fill in login form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit the form
  await page.click('button[type="submit"]');

  // Verify login was successful
  await expect(page).not.toHaveURL('http://localhost:3000/login');
});