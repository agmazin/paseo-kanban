// Numbers of chats and cards (0.3.0): Dialogs sidebar with muted numbers, board cards with the number line.
import { open, wsUrl } from './lib.mjs';
const out = process.argv[2] || '/tmp/kbt/keys';
const { b, p } = await open();
await p.goto(wsUrl); await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}-sidebar.png` });
await p.getByRole('button', { name: /канбан/i }).first().click(); await p.waitForTimeout(2000);
await p.getByText('ЭкоЭксперт', { exact: true }).last().click(); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}-board.png` });
const key = await p.locator('[data-testid^="kanban-card-"]').first().innerText();
console.log('first card text:', JSON.stringify(key));
await b.close();
