import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { DaemonClient } from '@getpaseo/client/internal/daemon-client';
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const home = '/Users/agmazin/Library/Developer/paseo-kanban/test-home';
const client = new DaemonClient({ url: 'ws://127.0.0.1:6786/ws', clientId: 'kanban-waiting-owner', clientType: 'cli', localCredential: async () => (await readFile(`${home}/local-credential`, 'utf8')).trim(), reconnect: { enabled: false } });
await client.connect();
const agents = (await client.fetchAgents({ filter: { includeArchived: false }, page: { limit: 200 } })).entries.map(e => e.agent);
let parent = agents.find(a => a.labels?.['test.waiting-owner'] === 'parent');
if (!parent) parent = await client.createAgent({ provider: 'claude', model: 'claude-haiku-5-5', cwd: '/Users/agmazin/Library/Developer/paseo-kanban/fixtures/CTG', title: 'Ожидание 0.3.5', labels: { 'test.waiting-owner': 'parent' } });
for (const [kind, title, mark] of [['ask', 'Выбрать вариант', 'ask'], ['review', 'Оценить дизайн', 'review'], ['stop', 'Ход остановился', 'work']]) {
  if (!agents.some(a => a.labels?.['test.waiting-owner'] === kind)) await client.createAgent({ provider: 'claude', model: 'claude-haiku-5-5', cwd: parent.cwd, workspaceId: parent.workspaceId, callerAgentId: parent.id, title, labels: { 'test.waiting-owner': kind, kanban: mark } });
}
const response = await client.invokePluginRpc('paseo-kanban', 'kanban.cards', { archived: true });
const cards = response.cards.filter(c => c.owner?.id === parent.id);
assert.equal(cards.length, 3);
assert.equal(cards.filter(c => c.waitingFor === 'alexander').length, 2);
assert.equal(cards.filter(c => c.waitingFor === 'techlead').length, 1);
await writeFile('docs/verification/waiting-0.3.5-rpc.json', JSON.stringify(cards, null, 2));
const browser = await chromium.launch({ executablePath: '/Users/agmazin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
try {
  for (const [width, scheme] of [[1440, 'dark'], [390, 'dark'], [1440, 'light']]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, locale: 'ru-RU' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:6786');
    await page.waitForTimeout(2500);
    if (width === 390) await page.getByLabel('Открыть меню').click();
    await page.getByText('Ожидание 0.3.5', { exact: false }).first().click();
    await page.waitForTimeout(2200);
    if (width === 390) {
      await page.getByRole('button', { name: 'Канбан чата' }).first().click();
    } else {
      const panel = page.getByTestId('workspace-explorer-sidebar');
      if (!(await panel.isVisible())) await page.getByTestId('workspace-explorer-toggle').first().click();
      await page.locator('[data-testid="workspace-explorer-sidebar"] [data-testid*="paseo-kanban"]').first().click();
    }
    const panel = page.getByTestId('kanban-chat');
    await panel.waitFor();
    await page.waitForTimeout(1800);
    assert.equal(await panel.getByTestId('kanban-ask-tag').count(), 2);
    assert.equal(await panel.getByTestId('kanban-techlead-tag').count(), 1);
    const stopped = panel.getByTestId(`kanban-card-${cards.find(c => c.waitingFor === 'techlead').id}`);
    assert.equal(await stopped.getByTestId('kanban-bang').count(), 0);
    assert.equal(await stopped.getByTestId('kanban-techlead-icon').count(), 1);
    await page.screenshot({ path: `docs/verification/waiting-0.3.5-${width}${scheme === "light" ? "-light" : ""}.png` });
    assert.deepEqual(errors, []);
    console.log(width, 'OK: 2 human tags, 1 techlead tag, no orange bang on stopped card');
    await page.close();
  }
} finally { await browser.close(); await client.close(); }
