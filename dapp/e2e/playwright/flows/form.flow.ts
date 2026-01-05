// dapp/e2e/playwright/flows/form.flow.ts
import { Page, expect } from '@playwright/test';

export async function submitMsgRito(page: Page, message: string) {
  // Switch back to Msg Rito tab (it’s open by default, but this is safe)
  await page.getByRole('tab', { name: /^Msg Rito$/i }).click();

  const textarea = page.locator('#gatedTextarea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(message);

  const submit =
    page.locator('#gatedSubmitButton').first()
      .or(page.getByRole('button', { name: /^Sign & Submit$/i }));

  await expect(submit).toBeVisible({ timeout: 10_000 });
  await submit.click();
}
