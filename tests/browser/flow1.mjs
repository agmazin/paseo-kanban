import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(1500);
await p.getByText('ЭкоЭксперт').nth(1).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /канбан/i }).first().click(); await p.waitForTimeout(2000);
// horizontal scroll over the board
const cols = p.getByTestId('kanban-cols');
const box = await cols.boundingBox(); console.log('cols box', JSON.stringify(box));
await p.mouse.move(box.x + 400, box.y + 300);
await p.mouse.wheel(600, 0); await p.waitForTimeout(500);
console.log('scrollLeft', await cols.evaluate(n => n.scrollLeft), 'scrollWidth', await cols.evaluate(n => n.scrollWidth), 'clientWidth', await cols.evaluate(n => n.clientWidth));
const colH = await p.getByTestId('kanban-col-scroll').first().evaluate(n => [n.clientHeight, n.scrollHeight]);
console.log('col scroll height', colH);
await p.screenshot({ path: '/tmp/kbt/5-scrolled.png' });
await p.getByTestId('kanban-archive-done').click(); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/kbt/6-archive-open.png' });
await b.close();
