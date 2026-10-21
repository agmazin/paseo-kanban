import { open } from './lib.mjs';
const { b, p } = await open();
const tabs = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="workspace-explorer-sidebar"] [data-testid^="workspace-tab-"]')].filter(n => n.getClientRects().length).map(n => (n.textContent||'').trim() + (n.getAttribute('aria-selected') === 'true' ? '*' : '')).join(' '));
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByText('Дебиторка', { exact: true }).first().click(); await p.waitForTimeout(2000);
await p.getByTestId('workspace-explorer-toggle').click(); await p.waitForTimeout(1500);
console.log('1 ЭЭ open:', await tabs());
await p.locator('[data-testid="workspace-explorer-sidebar"] [data-testid*="paseo-kanban"]').click(); await p.waitForTimeout(1000);
console.log('2 ЭЭ picked kanban:', await tabs());

await p.getByText('Оценки', { exact: true }).first().click(); await p.waitForTimeout(2500);
if (!(await p.evaluate(() => [...document.querySelectorAll('[data-testid="workspace-explorer-sidebar"]')].some(n => n.getClientRects().length)))) { const t = p.getByTestId('workspace-explorer-toggle'); for (let i = 0; i < await t.count(); i++) if (await t.nth(i).isVisible()) { await t.nth(i).click(); break; } await p.waitForTimeout(1500); }
console.log('3 CTG:', await tabs());
await p.screenshot({ path: '/tmp/kbt/d1-ctg.png' });
await p.locator('[data-testid="workspace-explorer-sidebar"]:visible [data-testid="workspace-tab-files"]').click(); await p.waitForTimeout(1000);
console.log('4 CTG picked files:', await tabs());
await p.getByText('Тендер', { exact: true }).first().click(); await p.waitForTimeout(2500);
console.log('5 back to ЭЭ:', await tabs());
await p.getByRole('button', { name: 'Канбан', exact: true }).first().click().catch(e => console.log('no sidebar row', e.message.slice(0, 80)));
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/kbt/d2-screen.png' });
await b.close();
