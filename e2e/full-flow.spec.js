import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@playstats.dev';
const TEST_PASSWORD = 'TestPlayStats2026!';

// Helper: login and wait for teams screen
async function login(page) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for teams list — "My Teams" (EN) or "Mis equipos" (ES)
  await page.waitForFunction(() => {
    return document.body.innerText.includes('My Teams') || document.body.innerText.includes('Mis equipos');
  }, { timeout: 15000 });
}

// Helper: delete all test teams for cleanup
async function deleteAllTeams(page) {
  let teamButtons = await page.locator('button:has-text("→")').all();
  while (teamButtons.length > 0) {
    await teamButtons[0].click();
    await page.waitForTimeout(1500);
    // Scroll down to find delete team button
    const deleteBtn = page.getByRole('button', { name: /Delete team|Eliminar equipo/ });
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.scrollIntoViewIfNeeded();
      await deleteBtn.click();
      // Confirm
      const confirmBtn = page.getByRole('button', { name: /Yes, delete|Sí, eliminar/ });
      await confirmBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
    } else {
      // Can't delete, go back
      const backBtn = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') });
      await backBtn.click();
      await page.waitForTimeout(500);
      break;
    }
    teamButtons = await page.locator('button:has-text("→")').all();
  }
}

test.describe('PlayStats Basketball - Full Flow', () => {

  test('1. Login shows teams list', async ({ page }) => {
    await login(page);
    // Should see heading "My Teams" or "Mis equipos"
    const myTeamsEN = page.getByRole('heading', { name: 'My Teams' });
    const myTeamsES = page.getByRole('heading', { name: 'Mis equipos' });
    const visible = await myTeamsEN.isVisible().catch(() => false) || await myTeamsES.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('2. Create team with short name, edit it, then delete', async ({ page }) => {
    await login(page);
    await deleteAllTeams(page);

    // --- CREATE TEAM ---
    const createBtn = page.getByRole('button', { name: /Create Team|Crear equipo/ });
    await createBtn.click();
    await page.waitForTimeout(500);

    // Fill team name (first text input in the form)
    const teamNameInput = page.locator('input[placeholder="e.g. Panthers U12"], input[placeholder="Ej: Panteras Alevín"]');
    await teamNameInput.fill('Test Team Playwright');

    // Fill short name (second text input)
    const shortNameInput = page.locator('input[placeholder="e.g. Panthers"], input[placeholder="Ej: Panteras"]');
    await shortNameInput.fill('TestPW');

    // Click Create
    const submitBtn = page.getByRole('button', { name: /^Create$|^Crear$/ });
    await submitBtn.click();

    // Wait for team detail page (should see team name in header)
    await page.waitForFunction(
      () => document.body.innerText.includes('Test Team Playwright'),
      { timeout: 15000 }
    );

    // --- VERIFY SHORT NAME APPEARS ---
    const shortNameText = page.locator('text=TestPW');
    await expect(shortNameText.first()).toBeVisible({ timeout: 5000 });

    // --- EDIT SHORT NAME ---
    // Click on the short name area to open editor
    const shortNameBtn = page.locator('button').filter({ hasText: 'TestPW' });
    await shortNameBtn.click();
    await page.waitForTimeout(300);

    // The edit input should appear
    const editInput = page.locator('input[placeholder="e.g. Panthers"], input[placeholder="Ej: Panteras"]');
    await expect(editInput).toBeVisible({ timeout: 3000 });
    await editInput.fill('PW-Edit');

    // Click the confirm button (the first small button next to the input)
    const confirmBtn = editInput.locator('..').locator('button').first();
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Verify new short name is displayed
    await expect(page.locator('text=PW-Edit').first()).toBeVisible({ timeout: 5000 });

    // --- CLEANUP: DELETE TEAM ---
    const deleteTeamBtn = page.getByRole('button', { name: /Delete team|Eliminar equipo/ });
    await deleteTeamBtn.scrollIntoViewIfNeeded();
    await deleteTeamBtn.click();
    const confirmDeleteBtn = page.getByRole('button', { name: /Yes, delete|Sí, eliminar/ });
    await confirmDeleteBtn.click();

    // Should be back on teams list
    await page.waitForFunction(
      () => document.body.innerText.includes('My Teams') || document.body.innerText.includes('Mis equipos'),
      { timeout: 10000 }
    );
  });

  test('3. Full game flow: create team, start game, score, exit', async ({ page }) => {
    await login(page);
    await deleteAllTeams(page);

    // --- CREATE TEAM ---
    const createBtn = page.getByRole('button', { name: /Create Team|Crear equipo/ });
    await createBtn.click();
    await page.waitForTimeout(500);

    const teamNameInput = page.locator('input[placeholder="e.g. Panthers U12"], input[placeholder="Ej: Panteras Alevín"]');
    await teamNameInput.fill('Game Test');

    const submitBtn = page.getByRole('button', { name: /^Create$|^Crear$/ });
    await submitBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes('Game Test'),
      { timeout: 15000 }
    );

    // --- START NEW GAME ---
    const newGameBtn = page.getByRole('button', { name: /new game|nuevo partido/i });
    await newGameBtn.click();
    await page.waitForTimeout(1000);

    // Step 1/4: Home/Away — click HOME
    await page.getByRole('button', { name: /HOME|Local/i }).click({ timeout: 5000 });
    await page.waitForTimeout(800);

    // Step 2/4: Team color — Orange is pre-selected, just click OK
    await page.getByRole('button', { name: 'OK' }).click({ timeout: 5000 });
    await page.waitForTimeout(800);

    // Step 3/4: Rival name — fill and click Next/OK
    const rivalInput = page.locator('input[type="text"]').first();
    if (await rivalInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rivalInput.fill('Test Rivals');
    }
    // Click the proceed/OK button
    const step3Btn = page.getByRole('button', { name: /^OK$|next|start|siguiente|empezar/i });
    await step3Btn.click({ timeout: 5000 });
    await page.waitForTimeout(800);

    // Step 4/4: Rival color — a color is pre-selected, click START GAME
    const startGameBtn = page.getByRole('button', { name: /start game|empezar partido/i });
    await startGameBtn.click({ timeout: 5000 });
    await page.waitForTimeout(800);

    // --- VERIFY GAME VIEW ---
    // Should see Q1 indicator
    await page.waitForFunction(
      () => document.body.innerText.includes('Q1'),
      { timeout: 15000 }
    );

    // --- START TIMER ---
    // The play button has lucide-play icon
    const playBtnSvg = page.locator('svg.lucide-play, svg.lucide-circle-play').first();
    const playBtn = playBtnSvg.locator('..');
    if (await playBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(2000); // Let the timer run 2 seconds
    }

    // --- SCORE 2 POINTS ---
    const pts2Btn = page.getByRole('button', { name: /2\s*PTS/i }).first();
    if (await pts2Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pts2Btn.click();
      await page.waitForTimeout(500);

      // Modal opens - click the first player button in the modal
      // The scoring modal shows player names as buttons
      const modal = page.locator('.fixed.inset-0').last();
      const playerBtn = modal.locator('button').first();
      if (await playerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerBtn.click();
        await page.waitForTimeout(500);

        // Click MADE
        const madeBtn = page.getByRole('button', { name: /MADE/i }).first();
        if (await madeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await madeBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // --- PAUSE TIMER ---
    const pauseSvg = page.locator('svg.lucide-pause, svg.lucide-circle-pause').first();
    const pauseBtn = pauseSvg.locator('..');
    if (await pauseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pauseBtn.click();
    }

    // --- EXIT GAME ---
    // Click the X button to exit
    const exitSvg = page.locator('svg.lucide-circle-x').first();
    const exitBtn = exitSvg.locator('..');
    if (await exitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exitBtn.click();
      await page.waitForTimeout(500);

      // Click "Save & Exit" button
      const saveExitBtn = page.getByRole('button', { name: /Save|Guardar/i }).first();
      if (await saveExitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveExitBtn.click();
      }
    }

    // Should be back on team detail page
    await page.waitForFunction(
      () => document.body.innerText.includes('Game Test'),
      { timeout: 15000 }
    );

    // Verify the game appears in the In Progress section
    const inProgressText = page.locator('text=/In progress|En proceso/i').first();
    await expect(inProgressText).toBeVisible({ timeout: 5000 });

    // --- CLEANUP: DELETE TEAM ---
    const deleteTeamBtn = page.getByRole('button', { name: /Delete team|Eliminar equipo/ });
    await deleteTeamBtn.scrollIntoViewIfNeeded();
    await deleteTeamBtn.click();
    const confirmDeleteBtn = page.getByRole('button', { name: /Yes, delete|Sí, eliminar/ });
    await confirmDeleteBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes('My Teams') || document.body.innerText.includes('Mis equipos'),
      { timeout: 10000 }
    );
  });
});
