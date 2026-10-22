// 0.2.0: "Принять" hands the card back to its chat (kanban=accepted, "В работе" with a tag); done is set by the chat.
// Usage: node flow16.mjs <phase: accept|done>; chat title "Чат 0.2.0" with one executor waiting for acceptance.
import { readFileSync } from 'node:fs';
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const phase = process.argv[2] || 'accept';
const b = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'ru-RU' });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
const panel = '[data-testid="workspace-explorer-sidebar"]:visible';
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByText('Чат 0.2.0', { exact: true }).first().click(); await p.waitForTimeout(2000);
if (!(await p.locator(panel).count())) { await p.getByTestId('workspace-explorer-toggle').first().click(); await p.waitForTimeout(1500); }
await p.locator(`${panel} [data-testid*="paseo-kanban"]`).first().click(); await p.waitForTimeout(2500);
const groups = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="kanban-chat"] [role="button"][aria-label*="вернуть"]')].map((n) => n.getAttribute('aria-label').split(',').slice(0, 2).join(':')).join(' > '));
const facts = () => p.evaluate(() => ({
  accept: document.querySelectorAll('[data-testid="kanban-accept"]').length,
  ret: document.querySelectorAll('[data-testid="kanban-return"]').length,
  tags: [...document.querySelectorAll('[data-testid="kanban-accepted-tag"]')].map((n) => n.textContent),
}));
await p.getByTestId('kanban-chat-menu').click(); await p.waitForTimeout(500);
const btnItem = p.getByRole('menuitem', { name: 'Кнопки приёмки' });
// The menu item carries no aria-checked; the saved prefs tell whether the buttons are on.
const state = JSON.parse(readFileSync('/Users/agmazin/Library/Developer/paseo-kanban/test-home/plugin-data/paseo-kanban/state.json', 'utf8'));
if (!state.prefs.buttons) await btnItem.click();
await p.waitForTimeout(400);
await p.locator(panel).getByLabel('Закрыть меню').click(); await p.waitForTimeout(800);
console.log(phase, 'before', await groups(), JSON.stringify(await facts()));
if (phase === 'accept') {
  await p.locator(panel).screenshot({ path: '/tmp/kbt/80-before.png' });
  await p.getByTestId('kanban-accept').first().click(); await p.waitForTimeout(5000);
  console.log('after accept', await groups(), JSON.stringify(await facts()));
  await p.locator(panel).screenshot({ path: '/tmp/kbt/81-accepted.png' });
} else {
  await p.locator(panel).screenshot({ path: '/tmp/kbt/82-done.png' });
}
await b.close();
