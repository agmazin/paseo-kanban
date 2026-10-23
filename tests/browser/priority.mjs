import assert from 'node:assert/strict';
const expect = (locator) => ({
  async toHaveAttribute(name, value) { for (let i = 0; i < 100; i++) { if (await locator.getAttribute(name) === value) return; await new Promise(r => setTimeout(r, 100)); } assert.equal(await locator.getAttribute(name), value); },
  async toHaveCount(value) { for (let i = 0; i < 100; i++) { if (await locator.count() === value) return; await new Promise(r => setTimeout(r, 100)); } assert.equal(await locator.count(), value); },
});
import { readFile, writeFile } from 'node:fs/promises';
import { DaemonClient } from '@getpaseo/client/internal/daemon-client';
import { chromium } from '/Users/agmazin/Library/Developer/paseo-dialogs/node_modules/playwright/index.mjs';
const version = process.env.KANBAN_TEST_VERSION || '0.3.6';
const home = '/Users/agmazin/Library/Developer/paseo-kanban/test-home';
const client = new DaemonClient({ url: 'ws://127.0.0.1:6786/ws', clientId: 'kanban-priority', clientType: 'cli', localCredential: async () => (await readFile(`${home}/local-credential`, 'utf8')).trim(), reconnect: { enabled: false } });
await client.connect();
const agents = (await client.fetchAgents({ filter: { includeArchived: false }, page: { limit: 200 } })).entries.map(e => e.agent);
let parent = agents.find(a => a.labels?.['test.waiting-owner'] === 'parent');
if (!parent) parent = await client.createAgent({ provider: 'claude', model: 'claude-haiku-5-5', cwd: '/Users/agmazin/Library/Developer/paseo-kanban/fixtures/CTG', title: 'Ожидание 0.3.5', labels: { 'test.waiting-owner': 'parent' } });
for (const [kind, title, mark] of [['ask', 'Выбрать вариант', 'ask'], ['review', 'Оценить дизайн', 'review'], ['stop', 'Ход остановился', 'work']]) {
  if (!agents.some(a => a.labels?.['test.waiting-owner'] === kind)) await client.createAgent({ provider: 'claude', model: 'claude-haiku-5-5', cwd: parent.cwd, workspaceId: parent.workspaceId, callerAgentId: parent.id, title, labels: { 'test.waiting-owner': kind, kanban: mark } });
}
const fixture = agents.filter(a => a.labels?.['test.waiting-owner'] && a.labels['test.waiting-owner'] !== 'parent');
for (const a of fixture) await client.invokePluginRpc('paseo-kanban', 'kanban.set-priority', { agentId: a.id, priority: a.labels['test.waiting-owner'] === 'ask' ? 'high' : a.labels['test.waiting-owner'] === 'stop' ? 'low' : 'normal' });
await client.invokePluginRpc('paseo-kanban', 'kanban.set-priority', { agentId: parent.id, priority: 'high' });
await assert.rejects(client.invokePluginRpc('paseo-kanban', 'kanban.set-priority', { agentId: parent.id, priority: 'invalid' }));
await assert.rejects(client.invokePluginRpc('paseo-kanban', 'kanban.set-priority', { agentId: 'missing-priority-agent', priority: 'high' }));
const response = await client.invokePluginRpc('paseo-kanban', 'kanban.cards', { archived: true });
const cards = response.cards.filter(c => c.owner?.id === parent.id);
assert.equal(cards.length, 3);
assert.equal(cards.filter(c => c.waitingFor === 'alexander').length, 2);
assert.equal(cards.filter(c => c.waitingFor === 'techlead').length, 1);
await writeFile(`docs/verification/priority-${version}-rpc.json`, JSON.stringify(cards, null, 2));
const geometry = [];
async function checkHeader(page, card, context) {
  const header = page.getByTestId(`kanban-card-header-${card.id}`);
  const flag = await header.getByTestId(`kanban-priority-${card.id}`).boundingBox();
  const status = await header.getByTestId(card.waitingFor === 'techlead' ? 'kanban-techlead-icon' : 'kanban-bang').boundingBox();
  const row = await header.boundingBox();
  assert.ok(Math.abs(flag.y + flag.height / 2 - status.y - status.height / 2) <= 1, `${context}: flag and status centered`);
  assert.ok(flag.x + flag.width <= status.x, `${context}: flag precedes status`);
  assert.equal(row.height, 24, `${context}: original 8 + 16 header height`);
  geometry.push({ context, row, flag, status });
}
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
    const card = cards.find(c => c.priority === 'high');
    const control = page.getByTestId(`kanban-priority-${card.id}`);
    await control.click();
    await page.getByRole('menuitem', { name: 'Низкий', exact: true }).click();
    await expect(control).toHaveAttribute('aria-label', 'Приоритет: Низкий');
    await expect(page.getByRole('menuitem', { name: 'Низкий', exact: true })).toHaveCount(0);
    await page.getByTestId(`kanban-priority-${card.id}`).click();
    await page.getByRole('menuitem', { name: 'Обычный', exact: true }).click();
    await expect(control).toHaveAttribute('aria-label', 'Приоритет: Обычный');
    await expect(page.getByRole('menuitem', { name: 'Обычный', exact: true })).toHaveCount(0);
    await page.getByTestId(`kanban-priority-${card.id}`).click();
    await page.getByRole('menuitem', { name: 'Высокий', exact: true }).click();
    await expect(control).toHaveAttribute('aria-label', 'Приоритет: Высокий');
    await page.waitForTimeout(700);
    const latest = await client.invokePluginRpc('paseo-kanban', 'kanban.cards', { archived: true });
    assert.equal(latest.cards.find(c => c.id === card.id).priority, 'high');
    await checkHeader(page, card, `chat-${width}-${scheme}`);
    await checkHeader(page, cards.find(c => c.waitingFor === 'techlead'), `chat-key-${width}-${scheme}`);
    await page.screenshot({ path: `docs/verification/priority-${version}-${width}${scheme === "light" ? "-light" : ""}.png` });
    assert.deepEqual(errors, []);
    console.log(width, scheme, 'OK priority UI and RPC');
    const boardPage = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, locale: 'ru-RU' });
    await boardPage.goto('http://127.0.0.1:6786');
    await boardPage.waitForTimeout(2500);
    if (width === 390) await boardPage.getByLabel('Открыть меню').first().click();
    await boardPage.getByText('Канбан', { exact: true }).first().click();
    await boardPage.getByTestId('kanban-board').waitFor();
    const chips = boardPage.getByRole('button', { name: 'Канбан CTG', exact: true });
    for (let i = 0; i < await chips.count(); i++) {
      await chips.nth(i).click();
      await boardPage.waitForTimeout(250);
      if (await boardPage.getByTestId(`kanban-card-${card.id}`).count()) break;
    }
    assert.equal(await boardPage.getByTestId(`kanban-card-${card.id}`).count(), 1);
    if (width === 390) await boardPage.getByTestId('kanban-cols').evaluate(n => { n.scrollLeft = 596; });
    await boardPage.waitForTimeout(500);
    await checkHeader(boardPage, card, `board-${width}-${scheme}`);
    await boardPage.screenshot({ path: `docs/verification/priority-${version}-board-${width}${scheme === "light" ? "-light" : ""}.png` });
    await boardPage.close();
    await page.close();
  }
  await writeFile(`docs/verification/priority-${version}-geometry.json`, JSON.stringify(geometry, null, 2));
} finally { await browser.close(); await client.close(); }
