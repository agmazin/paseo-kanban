// 0.1.17: panel sort "Этап Канбана" first and default; groups go Очередь -> Готово.
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'ru-RU' });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
const panel = '[data-testid="workspace-explorer-sidebar"]:visible';
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByText('Дебиторка', { exact: true }).first().click(); await p.waitForTimeout(2000);
if (!(await p.locator(panel).count())) { await p.getByTestId('workspace-explorer-toggle').first().click(); await p.waitForTimeout(1500); }
await p.locator(`${panel} [data-testid*="paseo-kanban"]`).first().click(); await p.waitForTimeout(2500);
const groups = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="kanban-chat"] [role="button"][aria-label*="свернуть"], [data-testid="kanban-chat"] [role="button"][aria-label*="развернуть"]')].map((n) => n.getAttribute('aria-label').split(',')[0]).join(' > '));
console.log('groups', await groups());
await p.getByTestId('kanban-chat-menu').click(); await p.waitForTimeout(400);
await p.getByRole('menuitem', { name: /Сортировка/ }).click(); await p.waitForTimeout(400);
console.log('sorts', (await p.getByRole('menuitem').allTextContents()).join(' | '));
await p.locator(panel).screenshot({ path: '/tmp/kbt/71-stage-menu.png' });
await p.getByRole('menuitem', { name: 'По убыванию' }).click(); await p.waitForTimeout(800);
console.log('desc groups', await groups());
await p.getByRole('menuitem', { name: 'По возрастанию' }).click(); await p.waitForTimeout(800);
await p.locator(panel).getByLabel('Закрыть меню').click(); await p.waitForTimeout(500);
await p.locator(panel).screenshot({ path: '/tmp/kbt/72-stage.png' });
await b.close();
