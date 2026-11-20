import AxeBuilder from "@axe-core/playwright";
import {expect,test} from "@playwright/test";
for(const [name,width,height] of [["desktop",1440,1000],["mobile",390,844]] as const){
  test(`Marketing OS customer platform ${name}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto("/e2e/marketing-platform",{waitUntil:"networkidle"});
    await expect(page.getByRole("heading",{name:"客戶工作區",exact:true})).toBeVisible();
    await expect(page.getByText("待開通",{exact:true}).filter({visible:true})).toBeVisible();
    await expect(page.getByText("平台管理",{exact:true})).toBeVisible();
    await page.locator("summary").filter({hasText:"建立客戶工作區"}).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("客戶名稱")).toBeVisible();
    await expect(page.getByRole("button",{name:"建立工作區",exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`marketing-platform-${name}.png`,{fullPage:true});
    const a11y=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    expect(a11y.violations).toEqual([]);
  });
}
test('customer shared-password session cannot enter platform control',async({page})=>{
  await page.goto('/platform');
  await expect(page).toHaveURL(/\/login\?.*platform_required/);
  await expect(page.getByText('呢個頁面只限平台管理員使用。')).toBeVisible();
});
