// dapp/e2e/playwright/flows/music-player.flow.ts
import { Page, expect } from '@playwright/test';

/**
 * Waits for the music bar to appear at the bottom of the chat
 */
export async function waitForMusicBar(page: Page, timeout: number = 10_000) {
  const musicBar = page.locator('#music-bar');
  await expect(musicBar).toBeVisible({ timeout });
  return musicBar;
}

/**
 * Clicks the music bar to pause/play
 */
export async function toggleMusicBar(page: Page) {
  const musicBar = page.locator('#music-bar button');
  await expect(musicBar).toBeVisible({ timeout: 5_000 });
  await musicBar.click();
}

/**
 * Asserts music bar shows a specific song
 */
export async function assertMusicBarSong(page: Page, songName: string) {
  const musicBar = page.locator('#music-bar');
  await expect(musicBar).toContainText(songName, { timeout: 5_000 });
}

/**
 * Asserts music bar is playing (shows pause button)
 */
export async function assertMusicBarPlaying(page: Page) {
  const musicBar = page.locator('#music-bar button');
  await expect(musicBar).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
}

/**
 * Asserts music bar is paused (shows play button)
 */
export async function assertMusicBarPaused(page: Page) {
  const musicBar = page.locator('#music-bar button');
  await expect(musicBar).toHaveAttribute('aria-pressed', 'false', { timeout: 5_000 });
}

/**
 * Full flow: Request song via chat, wait for bar, toggle pause
 */
export async function playSongViaChat(page: Page, songRequest: string, expectedSongName: string) {
  // This is typically called after chatOnce() which sends the message
  // Here we just wait for the music bar and verify
  const musicBar = await waitForMusicBar(page);
  await assertMusicBarSong(page, expectedSongName);
  
  // Initially should be playing
  await assertMusicBarPlaying(page);
  
  // Click to pause
  await toggleMusicBar(page);
  await assertMusicBarPaused(page);
  
  console.log(`✅ Music bar appeared and toggled for: ${expectedSongName}`);
}