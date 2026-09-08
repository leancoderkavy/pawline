import { test, expect } from '@playwright/test';

test('two accounts book, reschedule, join, finish, choose a next step and cancel a final visit', async ({ browser }) => {
  const a = await browser.newContext(), s = await browser.newContext();
  const errors = [];
  try {
    const adopter = await a.newPage(), shelter = await s.newPage();
    for (const page of [adopter, shelter]) page.on('pageerror', error => errors.push(error.message));
    await a.request.post('http://127.0.0.1:4331/api/direct-conversations', { headers: { Authorization: 'Bearer fixture:adopter' }, data: { listingId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } });
    await adopter.goto('/?user=adopter'); await shelter.goto('/?user=shelter');
    await adopter.getByRole('button', { name: /Miso.*Willow/ }).click();
    await adopter.getByRole('button', { name: 'Appointments', exact: true }).click();
    await adopter.getByRole('button', { name: 'Propose an appointment' }).click();
    for (const width of [320, 768, 1024, 1440]) {
      await adopter.setViewportSize({ width, height: 900 });
      await expect(adopter.getByRole('button', { name: 'Propose time', exact: true })).toBeVisible();
      expect(await adopter.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const dialog = await adopter.getByRole('dialog').boundingBox();
      expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.x + dialog.width).toBeLessThanOrEqual(width + 1);
    }
    await adopter.getByLabel('What would you like to talk about?').fill('Can we see Miso playing with a favorite toy?');
    await adopter.getByRole('button', { name: 'Propose time', exact: true }).click();
    await expect(adopter.getByText('Waiting for confirmation', { exact: true })).toBeVisible();
    await shelter.getByRole('button', { name: /Miso.*Alex/ }).click();
    await shelter.getByRole('button', { name: /Appointments/ }).click();
    await shelter.getByRole('button', { name: 'Suggest another time' }).click();
    const local = new Date(); const value = new Date(local - local.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    await shelter.getByLabel('Your local date and time').fill(value);
    await shelter.getByRole('button', { name: 'Propose time', exact: true }).click();
    await adopter.getByRole('button', { name: 'Confirm this time' }).click();
    const calendar = adopter.waitForEvent('download');
    await adopter.getByRole('button', { name: 'Add to calendar' }).click();
    expect((await calendar).suggestedFilename()).toBe('pawline-appointment.ics');
    await adopter.getByRole('button', { name: 'Join video hello', exact: true }).click();
    await shelter.getByRole('button', { name: 'Join video hello', exact: true }).click();
    for (const page of [adopter, shelter]) await expect(page.getByText('You’re in the call. You can keep your camera off.')).toBeVisible();
    await adopter.getByRole('button', { name: 'Return to messages', exact: true }).click();
    await expect(adopter.locator('iframe')).toHaveCount(0);
    await adopter.getByRole('button', { name: 'Join video hello', exact: true }).click();
    await expect(adopter.getByText('You’re in the call. You can keep your camera off.')).toBeVisible();
    await adopter.getByRole('button', { name: 'Finish appointment for both people' }).click();
    await expect(adopter.getByRole('heading', { name: 'What happens next?' })).toBeVisible();
    await expect(shelter.getByRole('alert')).toContainText('no longer open');
    await expect(shelter.locator('iframe')).toHaveCount(0);
    await adopter.getByRole('button', { name: 'Arrange a final visit', exact: true }).click();
    await adopter.getByLabel('Visit arrangements').fill('Meet at the shelter reception.');
    await adopter.getByRole('button', { name: 'Propose time', exact: true }).click();
    await shelter.getByRole('button', { name: 'Return to messages', exact: true }).click();
    await shelter.getByRole('button', { name: 'Confirm this time' }).click();
    await expect(adopter.getByRole('article', { name: 'Final visit appointment' }).getByText('Confirmed', { exact: true })).toBeVisible();
    await adopter.getByRole('button', { name: 'Cancel appointment', exact: true }).click();
    await expect(adopter.getByText('Cancelled', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await a.close(); await s.close(); }
});
