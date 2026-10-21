import { open, root } from './lib.mjs';
const { b, p } = await open(390, 844);
for (const chat of ['Оценки', 'Тендер']) {
  await p.goto(root); await p.waitForTimeout(2500);
  await p.getByLabel('Открыть меню').click(); await p.waitForTimeout(800);
  await p.getByText(chat, { exact: true }).first().click(); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Канбан чата' }).first().click(); await p.waitForTimeout(2000);
  const h = await p.getByTestId('kanban-overlay').evaluate(n => Math.round(n.getBoundingClientRect().height));
  const sc = await p.getByTestId('kanban-chat').evaluate(n => [n.clientHeight, n.scrollHeight]);
  console.log(chat, 'overlay height', h, 'scroll', sc);
}
await b.close();
