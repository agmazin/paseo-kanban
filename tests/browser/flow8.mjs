import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(1500);
await p.getByText('ЭкоЭксперт').nth(1).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /канбан/i }).first().click(); await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/kbt/21-empty-cols.png' });
// explorer: open sidebar, close existing kanban tab if any, use "+"
await p.getByTestId('workspace-tab-agent_2388dce3-a6e9-4073-828d-28e0c7ae1985').first().click(); await p.waitForTimeout(1200);
const toggle = p.getByTestId('workspace-explorer-toggle');
if (!(await p.getByTestId('workspace-explorer-sidebar').isVisible().catch(() => false))) { await toggle.click(); await p.waitForTimeout(800); }
await p.screenshot({ path: '/tmp/kbt/22-explorer.png' });
console.log(await p.getByTestId('workspace-explorer-sidebar').locator('[aria-label]').evaluateAll(n => n.map(x => x.getAttribute('aria-label')).slice(0, 30)));
await b.close();
