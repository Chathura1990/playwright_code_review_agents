import { expect, Page, test } from '@playwright/test';


test('example test', async ({ page }: { page: Page }) => {
  await page.locator('text=Hello World').click();
  await expect(page.locator('text=Hello World')).toBeVisible();
});