// Phone-width sheet: the "..." button sits over the first group row, the menu fits the sheet.
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'ru-RU' });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
await p.goto('http://127.0.0.1:6786'); await p.waitForTimeout(2500);
await p.getByLabel('Открыть меню').click(); await p.waitForTimeout(800);
await p.getByText('Дебиторка', { exact: false }).first().click(); await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'Канбан чата' }).first().click(); await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/kbt/66-sheet.png' });
await p.getByTestId('kanban-chat-menu').click(); await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/kbt/67-sheet-menu.png' });
await b.close();
