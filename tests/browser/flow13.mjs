import { open, wsUrl } from './lib.mjs';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(2000);
await p.getByText('Тендер', { exact: true }).first().click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Открыть канбан пространства/ }).click(); await p.waitForTimeout(2500);
console.log('tags', await p.getByTestId('kanban-ask-tag').count());
await p.screenshot({ path: '/tmp/kbt/33-ask-tag.png' });
await b.close();
