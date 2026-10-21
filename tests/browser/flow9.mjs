import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(1500);
await p.getByText('ЭкоЭксперт').nth(1).click(); await p.waitForTimeout(1500);
await p.getByTestId('workspace-tab-agent_2388dce3-a6e9-4073-828d-28e0c7ae1985').first().click(); await p.waitForTimeout(1200);
if (!(await p.getByTestId('workspace-explorer-sidebar').isVisible().catch(() => false))) { await p.getByTestId('workspace-explorer-toggle').click(); await p.waitForTimeout(800); }
const side = p.getByTestId('workspace-explorer-sidebar');
await side.getByLabel('Новая вкладка').click(); await p.waitForTimeout(600);
await p.screenshot({ path: '/tmp/kbt/23-plus-menu.png' });
await p.getByRole('menuitem', { name: /Канбан/ }).first().click().catch(async () => { await p.getByText('Канбан', { exact: true }).last().click(); });
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/kbt/24-explorer-kanban.png' });
await p.getByTestId('workspace-tab-agent_c00dbb33-83ee-419e-b82f-cf21d4e400ca').first().click(); await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/kbt/25-explorer-follow.png' });
await b.close();
