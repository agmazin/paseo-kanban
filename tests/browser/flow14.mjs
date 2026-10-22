// 0.1.16: spinner on running cards, orange "!" on questions, panel "..." menu, accept/return buttons.
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'ru-RU' });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
const panel = '[data-testid="workspace-explorer-sidebar"]:visible';
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByText('Дебиторка', { exact: true }).first().click(); await p.waitForTimeout(2000);
if (!(await p.locator(panel).count())) { await p.getByTestId('workspace-explorer-toggle').first().click(); await p.waitForTimeout(1500); }
await p.locator(`${panel} [data-testid*="paseo-kanban"]`).first().click(); await p.waitForTimeout(2500);
const facts = await p.evaluate(() => {
  const sp = document.querySelector('[data-testid="kanban-spinner"]');
  return {
    spinners: document.querySelectorAll('[data-testid="kanban-spinner"]').length,
    animation: sp ? getComputedStyle(sp).animationName : null,
    bangs: document.querySelectorAll('[data-testid="kanban-bang"]').length,
    askTags: document.querySelectorAll('[data-testid="kanban-ask-tag"]').length,
    executorRows: document.querySelectorAll('[data-testid="kanban-executor"]').length,
  };
});
console.log('panel', JSON.stringify(facts));
await p.locator(panel).screenshot({ path: '/tmp/kbt/60-panel.png' });
await p.getByTestId('kanban-chat-menu').click(); await p.waitForTimeout(500);
await p.locator(panel).screenshot({ path: '/tmp/kbt/61-menu.png' });
const btnItem = p.getByRole('menuitem', { name: 'Кнопки приёмки' });
if ((await btnItem.getAttribute('aria-checked')) !== 'true') await btnItem.click();
await p.waitForTimeout(400);
console.log('buttons item checked', await btnItem.getAttribute('aria-checked'));
await p.getByRole('menuitem', { name: 'Показывать ответственного' }).click(); await p.waitForTimeout(400);
console.log('executor rows after hide', await p.getByTestId('kanban-executor').count());
await p.getByRole('menuitem', { name: 'Показывать ответственного' }).click(); await p.waitForTimeout(400);
await p.getByRole('menuitem', { name: /Сортировка/ }).click(); await p.waitForTimeout(300);
await p.locator(panel).screenshot({ path: '/tmp/kbt/62-sort.png' });
await p.getByLabel('Закрыть меню').click(); await p.waitForTimeout(800);
console.log('accept buttons', await p.getByTestId('kanban-accept').count());
await p.locator(panel).screenshot({ path: '/tmp/kbt/63-buttons.png' });
await p.getByTestId('kanban-return').first().click(); await p.waitForTimeout(500);
await p.getByTestId('kanban-return-input').fill('Проверка поля замечаний');
await p.locator(panel).screenshot({ path: '/tmp/kbt/64-return.png' });
await p.getByRole('button', { name: 'Отмена' }).click(); await p.waitForTimeout(400);
await p.getByTestId('kanban-accept').first().click(); await p.waitForTimeout(3500);
console.log('accept buttons after accept', await p.getByTestId('kanban-accept').count());
await p.locator(panel).screenshot({ path: '/tmp/kbt/65-accepted.png' });
await b.close();
