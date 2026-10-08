import { expect, test } from '@playwright/test';

test('ordinary colleague sees the same Lead Sheet update button', async ({ browser, page: masterPage },testInfo) => {
  await masterPage.goto('/dashboard');
  const masterButton=masterPage.getByRole('button',{name:'跟 Lead Sheet 更新',exact:true});
  await expect(masterButton).toBeVisible();
  // The offline CI fixture has no connected source. Source availability must
  // affect every role equally; a colleague must not acquire a role-only gate.
  const sourceAvailable=await masterButton.isEnabled();
  const context=await browser.newContext({storageState:{cookies:[],origins:[]}});
  const page=await context.newPage();
  try {
    await page.goto('/login?next=/dashboard');
    if(!await page.getByLabel('Password').isVisible())await page.getByText(/切換期間管理員登入|緊急管理員登入/).click();
    await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD||'playwright-ci-password');
    await page.getByRole('button',{name:'管理員登入',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    const button=page.getByRole('button',{name:'跟 Lead Sheet 更新',exact:true});
    await expect(button).toBeVisible();
    if(sourceAvailable) {
      await expect(button).toBeEnabled();
      await button.focus();await expect(button).toBeFocused();
    } else {
      await expect(button).toBeDisabled();
    }
    await expect(page.getByText('由 Master 手動更新')).toHaveCount(0);
    await page.screenshot({path:testInfo.outputPath('all-staff-sheet-refresh.png'),animations:'disabled'});
    await page.goto('/performance');
    await expect(page.getByRole('button',{name:'同步 CS Lead',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'查看資料來源',exact:true})).toHaveCount(0);
  } finally {await context.close();}
});
