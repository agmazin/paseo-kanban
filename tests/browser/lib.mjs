import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
export const SRV = readFileSync('/Users/agmazin/Library/Developer/paseo-kanban/test-home/server-id', 'utf8').trim();
export const W = readFileSync('/tmp/kb-w', 'utf8').trim();
export const root = 'http://127.0.0.1:6786';
export const wsUrl = `${root}/h/${SRV}/workspace/${W}`;
export async function open(width = 1440, height = 900) {
  const b = await chromium.launch({ headless: true, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width, height }, colorScheme: 'dark' });
  p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('pageerror:', e.message.slice(0, 300)));
  return { b, p };
}
