'use strict';
// Browser logic smoke tests with an in-memory DOM/storage adapter, not visual browser tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { ledger, point } = require('./fixtures.js');
const ledgerKey = 'perk-track-ledger-v1';
function mount(data = ledger(), replies = [], confirm = () => true) {
  const elements = new Map(), documentEvents = {}, windowEvents = {}, downloads = [], requests = [];
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', value: '', dataset: {}, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, showModal() {}, close() {} });
    return elements.get(selector);
  }
  function storage(values) {
    const map = new Map(Object.entries(values));
    return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
  }
  const localStorage = storage({ [ledgerKey]: JSON.stringify(data), 'perk-track-github-v1': JSON.stringify({ owner: 'fictional-owner', repo: 'fictional-ledger', path: 'data.json' }) });
  const sessionStorage = storage({ 'perk-track-token-v1': 'fictional-test-token' });
  const context = {
    localStorage, sessionStorage, location: { hash: '#overview' }, confirm,
    structuredClone, TextEncoder, TextDecoder, Uint8Array, btoa, atob, AbortSignal, Blob, FormData,
    crypto: { randomUUID: () => 'fictional-new-record' }, setTimeout() {},
    URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:fictional'; }, revokeObjectURL() {} },
    document: { querySelector: element, querySelectorAll: () => [], addEventListener: (name, fn) => { documentEvents[name] = fn; }, createElement: () => ({ click() {}, remove() {} }), body: { append() {} } },
    window: { addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    fetch: async (url, options) => { requests.push({ url, options }); if (!replies.length) throw new Error('Unexpected network request'); return replies.shift(); }
  };
  vm.createContext(context);
  for (const file of ['core.js', 'reports.js', 'github.js', 'app.js']) vm.runInContext(fs.readFileSync(require.resolve(`../${file}`), 'utf8'), context, { filename: file });
  return {
    element, localStorage, downloads, requests, context,
    route(page) { context.location.hash = `#${page}`; windowEvents.hashchange(); },
    click(action, extra = {}) { documentEvents.click({ target: { closest: () => ({ dataset: { action, ...extra } }) } }); }
  };
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('all pages render fictional / year-only data without a network request or SUB progress fields', () => {
  const d = ledger();
  d.cards[0].subGoal = 16000; d.cards[0].subSpent = 12345; d.cards[0].trackSubSpending = true; d.cards[0].subStatus = 'pending';
  d.points = [point('annual', 'earn', { date: undefined, periodYear: 2026, amount: 1000 })];
  d.costs = [{ id: 'annual-fee', name: 'Fictional fee', amount: 95, periodYear: 2026 }];
  d.banks = [{ id: 'bank', name: 'Fictional checking', openDate: '2026-01-01' }];
  d.bankEvents = [{ id: 'bank-bonus', bankId: 'bank', type: 'bonus', amount: 100, periodYear: 2026 }];
  const app = mount(d);
  for (const page of ['overview', 'cards', 'perks', 'banks', 'points', 'earn', 'settings']) {
    assert.doesNotThrow(() => app.route(page)); assert.ok(app.element('#main').innerHTML.length > 0);
  }
  app.route('cards'); assert.match(app.element('#main').innerHTML, /累计消费目标/);
  assert.doesNotMatch(app.element('#main').innerHTML, /12,345/);
  app.click('edit', { type: 'cards', id: 'fictional-card' });
  assert.doesNotMatch(app.element('#editor-fields').innerHTML, /subSpent|trackSubSpending/);
  assert.equal(app.requests.length, 0);
});

test('CPP input automatically saves locally and refreshes reward calculations without cloud writes', () => {
  const d = ledger(); d.points = [point('spend', 'earn', { incomeBucket: 'spend', amount: 1000, cardId: 'fictional-card' })];
  const app = mount(d);
  app.element('#main').listeners.input({ target: { dataset: { cpp: 'Aeroplan' }, value: '2' } });
  const saved = JSON.parse(app.localStorage.getItem(ledgerKey));
  assert.equal(saved.settings.valuations.Aeroplan, 2);
  assert.match(app.element('[data-report-metrics]').innerHTML, /\$20\.00/);
  assert.equal(app.requests.length, 0);
});

test('JSON exports contain the ledger, without GitHub config or session token', async () => {
  const app = mount(); app.click('export');
  assert.equal(app.downloads.length, 1);
  const text = await app.downloads[0].text(); const exported = JSON.parse(text);
  assert.equal(exported.schemaVersion, 1); assert.equal(exported.cards[0].name, 'Fictional Travel Card');
  assert.doesNotMatch(text, /fictional-test-token|fictional-ledger|fictional-owner/);
});

test('full JSON import backs up, replaces locally, and blocks saving over an unread cloud ledger', async () => {
  const original = ledger(), next = ledger(); next.cards[0].name = 'Fictional imported card';
  const app = mount(original, [response(200, { default_branch: 'main' }), response(200, { sha: 'cloud-sha', type: 'file' })]);
  await app.element('#import-file').onchange({ target: { files: [{ size: 100, text: async () => JSON.stringify(next) }] } });
  assert.equal(app.downloads.length, 1);
  assert.deepEqual(JSON.parse(await app.downloads[0].text()), { ...original, rewardRules: [] });
  assert.equal(JSON.parse(app.localStorage.getItem(ledgerKey)).cards[0].name, 'Fictional imported card');
  await app.element('#github-save').onclick();
  assert.ok(app.requests.every(r => r.options.method !== 'PUT'));
  assert.match(app.element('#notice').textContent, /先.*读取云端/);
});

test('cancelled or invalid imports leave the original ledger intact', async () => {
  const d = ledger(); const app = mount(d, [], () => false);
  for (const text of [JSON.stringify(ledger()), '{invalid']) {
    await app.element('#import-file').onchange({ target: { files: [{ size: 10, text: async () => text }] } });
    assert.deepEqual(JSON.parse(app.localStorage.getItem(ledgerKey)), d);
  }
  assert.equal(app.downloads.length, 0); assert.equal(app.requests.length, 0);
});

test('cloud read validates before replacing locally, and an invalid response cannot enable a write', async () => {
  const d = ledger();
  const app = mount(d, [response(200, { type: 'file', encoding: 'base64', content: btoa(JSON.stringify({ schemaVersion: 999 })), sha: 'bad-sha' })]);
  app.click('github-load'); await tick();
  assert.deepEqual(JSON.parse(app.localStorage.getItem(ledgerKey)), d);
  assert.match(app.element('#notice').textContent, /不是支持/);
  assert.equal(app.requests.length, 1); assert.equal(app.downloads.length, 1);
});

test('a manual save sends the loaded SHA; conflict leaves local changes available for backup', async () => {
  const d = ledger();
  const app = mount(d, [response(200, { type: 'file', encoding: 'base64', content: btoa(JSON.stringify(d)), sha: 'loaded-sha' }), response(409, {})]);
  app.click('github-load'); await tick();
  app.element('#main').listeners.input({ target: { dataset: { cpp: 'Aeroplan' }, value: '2' } });
  await app.element('#github-save').onclick();
  assert.equal(JSON.parse(app.requests[1].options.body).sha, 'loaded-sha');
  assert.equal(JSON.parse(app.localStorage.getItem(ledgerKey)).settings.valuations.Aeroplan, 2);
  assert.match(app.element('#notice').textContent, /停止覆盖/);
  assert.equal(app.element('#github-save').disabled, false);
});
