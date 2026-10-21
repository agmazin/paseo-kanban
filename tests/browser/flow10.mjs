import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(1500);
await p.getByText('ЭкоЭксперт').nth(1).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Открыть канбан пространства/ }).click(); await p.waitForTimeout(2000);
await p.getByTestId('kanban-card-1a4f797b-bd97-4ba5-95ad-d3d779c0c08c').click(); await p.waitForTimeout(2000);
for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: /Канбан чата/ }).first().click(); await p.waitForTimeout(1200); }
const side = p.getByTestId('workspace-explorer-sidebar');
const tabs = await side.locator('[role="tab"], [data-testid^="workspace-tab-"]').evaluateAll(n => n.map(x => (x.textContent || '').trim()).filter(Boolean));
console.log('explorer tabs', JSON.stringify(tabs));
await p.screenshot({ path: '/tmp/kbt/26-pill-open.png' });
await b.close();
