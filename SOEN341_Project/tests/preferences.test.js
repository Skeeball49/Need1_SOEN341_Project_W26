const { test, expect } = require('@playwright/test');

// Use an existing registered account
const testEmail = 'test@school.ca';
const testPassword = 'Test1234';

test('User can login and update dietary preferences', async ({ page }) => {

  //go to home page 
  await page.goto('http://localhost:3000/');

  // click "Get Started" button 
  await page.click('a[href="/register"]:has-text("Get started")');

  // since we already have an account, click "I already have an account"
  await page.click('a[href="/login"]');

  // Fill in login form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // submit login form
  await page.click('button[type="submit"]');

  // Verify we are on the dashboard 
  await expect(page).toHaveURL('http://localhost:3000/dashboard');

  // Select a diet from the dropdown 
  await page.selectOption('select[name="diet"]', 'Vegan');

  // Type allergies separated by commas 
  await page.fill('input[name="allergies"]', 'Peanuts, Shellfish, Dairy');

  // click "Update Preferences" 
  await page.click('button[type="submit"]');

  // Verify preferences were saved (no error, back on dashboard)
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
  await expect(page.locator('text=Vegan')).toBeVisible();
  await expect(page.locator('text=Peanuts, Shellfish, Dairy')).toBeVisible();
});