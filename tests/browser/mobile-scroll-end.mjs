// Phone sheet: every card of the chat can be scrolled into view (the host sheet is capped at 80% of the screen).
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 390, height: 430 }, colorScheme: 'dark', locale: 'ru-RU' });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByLabel('Открыть меню').click(); await p.waitForTimeout(800);
await p.getByText('Дебиторка', { exact: false }).first().click(); await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'Канбан чата' }).first().click(); await p.waitForTimeout(2500);
// Scroll every scroll container around the list to its end, as far as a finger could.
const res = await p.evaluate(() => {
  const list = document.querySelector('[data-testid="kanban-chat"]');
  const scrollers = [];
  for (let n = list; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY !== 'visible') scrollers.push(n);
  // A finger on the list scrolls the innermost scroller only; the host sheet's own scroller stays put.
  scrollers[0].scrollTop = scrollers[0].scrollHeight;
  const outer = scrollers[scrollers.length - 1].getBoundingClientRect();
  const items = [...list.querySelectorAll('[role="button"]')];
  const last = items[items.length - 1].getBoundingClientRect();
  const sheet = document.querySelector('[data-testid="kanban-overlay"]').getBoundingClientRect();
  return { scrollers: scrollers.length, lastBottom: Math.round(last.bottom), viewport: Math.round(Math.min(innerHeight, outer.bottom)), sheetTop: Math.round(sheet.top), sheetH: Math.round(sheet.height), last: items[items.length - 1].getAttribute('aria-label') };
});
console.log(JSON.stringify(res), res.lastBottom <= res.viewport ? 'OK: last row visible' : 'BUG: last row below the screen');
await p.screenshot({ path: '/tmp/kbt/90-sheet-end.png' });
await b.close();
