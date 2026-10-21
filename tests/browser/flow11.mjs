import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/kbt/26b-start.png' });
await p.getByText('Дебиторка', { exact: true }).first().click(); await p.waitForTimeout(2000);
console.log(p.url());
await p.getByTestId('workspace-explorer-toggle').click(); await p.waitForTimeout(1500);
const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-testid="workspace-explorer-sidebar"] [data-testid^="workspace-tab-"]')].map(n => (n.textContent||'').trim() + ':' + n.getAttribute('aria-selected')));
console.log('explorer tabs', JSON.stringify(tabs));
await p.screenshot({ path: '/tmp/kbt/27-explorer-auto.png' });
await p.locator('[data-testid="workspace-explorer-sidebar"] [data-testid*="paseo-kanban"]').click(); await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/kbt/28-explorer-kanban.png' });
// close explorer and reopen: tab persists, no duplicates
await p.getByTestId('workspace-explorer-toggle').click(); await p.waitForTimeout(600);
await p.getByTestId('workspace-explorer-toggle').click(); await p.waitForTimeout(1200);
console.log('after reopen', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-testid="workspace-explorer-sidebar"] [data-testid^="workspace-tab-"]')].map(n => (n.textContent||'').trim() + ':' + n.getAttribute('aria-selected')))));
await p.getByRole('button', { name: /Открыть канбан пространства/ }).click(); await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/kbt/29-board-colors.png' });
await b.close();
