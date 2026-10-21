import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(1500);
await p.getByText('ЭкоЭксперт').nth(1).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /канбан/i }).first().click(); await p.waitForTimeout(2000);
await p.getByTestId('kanban-sort-button').click(); await p.waitForTimeout(300);
await p.locator('[role=menuitem][aria-label^="Группировать по"]').click(); await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/kbt/7-groupmenu.png' });
await p.locator('[role=menuitem][aria-label="Агент"]').click(); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/kbt/8-by-chat.png' });
await p.getByTestId('kanban-view-button').click(); await p.waitForTimeout(300);
await p.locator('[role=menuitem][aria-label="Показать детали"]').click(); await p.waitForTimeout(2500);
await p.mouse.click(700, 800); await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/kbt/9-details.png' });
// restore defaults
await p.getByTestId('kanban-view-button').click(); await p.locator('[role=menuitem][aria-label="Показать детали"]').click(); await p.mouse.click(700, 800);
await p.getByTestId('kanban-sort-button').click(); await p.locator('[role=menuitem][aria-label^="Группировать по"]').click(); await p.locator('[role=menuitem][aria-label="Статус"]').click();
await p.waitForTimeout(500);
await b.close();
