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

  // Verify redirected to login after register
  await expect(page).toHaveURL('http://localhost:3000/login');

  // Fill in login form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit login form
  await page.click('button[type="submit"]');

  // Verify redirected to onboarding (new users need to complete setup)
  await expect(page).toHaveURL(/\/onboarding/);

  // Complete onboarding - Step 1: Select allergies
  await page.click('.allergy-tile[data-value="Nuts"]');
  await page.click('.allergy-tile[data-value="Dairy"]');
  await page.click('#next-0');

  // Step 2: Select a diet (wait for slide to be visible)
  await page.waitForSelector('#slide-1.active');
  await page.click('.diet-card[data-value="Vegan"]');
  await page.click('#next-1');

  // Step 3: Submit onboarding (wait for final slide)
  await page.waitForSelector('#slide-2.active');
  await page.click('button.onb-submit-btn');

  // Verify we reached the dashboard
  await expect(page).toHaveURL(/\/dashboard/);

  // Navigate to profile page to update preferences
  await page.click('a[href*="/profile"]');
  await expect(page).toHaveURL(/\/profile/);

  // Click Edit button for Food Profile section (first one is for Food Profile)
  await page.locator('button:has-text("Edit")').first().click();

  // Update diet to High-Protein
  await page.selectOption('select[name="diet"]', 'High-Protein');

  // Update allergies
  await page.fill('input[name="allergies"]', 'Peanuts, Shellfish, Dairy');

  // Click Save
  await page.click('button[type="submit"]:has-text("Save")');

  // Verify preferences were saved - check the view mode shows updated values
  await expect(page.locator('.prof-row-val:has-text("High-Protein")')).toBeVisible();
  await expect(page.locator('.prof-chip-allergy:has-text("Peanuts")')).toBeVisible();
  await expect(page.locator('.prof-chip-allergy:has-text("Shellfish")')).toBeVisible();
  await expect(page.locator('.prof-chip-allergy:has-text("Dairy")')).toBeVisible();
});
