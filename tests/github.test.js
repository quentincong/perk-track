'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { GithubStore, encode, decode, config } = require('../github.js');
const settings = { owner: 'fictional-owner', repo: 'fictional-ledger', path: 'folder/测试.json', branch: 'fictional-branch', token: 'fictional-test-token' };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const file = (data, sha = 'latest-sha') => ({ type: 'file', encoding: 'base64', content: encode(JSON.stringify(data)), sha });
function fake(...replies) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    const reply = replies.shift();
    if (!reply) throw new Error('Unexpected request');
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { store: new GithubStore(settings, request), calls };
}

test('browser default fetch is bound to globalThis (Illegal invocation regression)', async () => {
  const sandbox = { TextEncoder, TextDecoder, Uint8Array, btoa, atob, AbortSignal };
  let bound = false;
  vm.createContext(sandbox);
  vm.runInContext("globalThis.fetch = function () { if (this !== globalThis) throw new Error('Illegal invocation'); return recordFetch(); };", sandbox);
  sandbox.recordFetch = async () => { bound = true; return response(200, file({ note: '虚构数据 ✈' })); };
  vm.runInContext(fs.readFileSync(require.resolve('../github.js'), 'utf8'), sandbox);
  const store = new sandbox.PerkGithub.GithubStore(settings);
  assert.equal((await store.read()).note, '虚构数据 ✈');
  assert.equal(bound, true);
});

test('Unicode JSON reads and writes round trip with the read SHA and selected branch', async () => {
  const data = { note: '虚构数据 ✈ €', amount: 0 };
  const { store, calls } = fake(response(200, file(data)), response(200, { content: { sha: 'new-sha' } }), response(200, { content: { sha: 'next-sha' } }));
  assert.deepEqual(await store.read(), data);
  assert.ok(calls[0].url.endsWith('/folder/%E6%B5%8B%E8%AF%95.json?ref=fictional-branch'));
  assert.equal(await store.save(data), 'new-sha');
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.sha, 'latest-sha'); assert.equal(body.branch, 'fictional-branch');
  assert.deepEqual(JSON.parse(decode(body.content)), data);
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fictional-test-token');
  assert.equal(JSON.stringify(body).includes(settings.token), false);
  await store.save(data); assert.equal(JSON.parse(calls[2].options.body).sha, 'new-sha');
});

test('testing connection to an existing file never permits overwrite without reading it', async () => {
  const { store, calls } = fake(response(200, { default_branch: 'main' }), response(200, file({ note: 'Remote' })));
  assert.deepEqual(await store.prepare(), { exists: true });
  assert.equal(store.loaded, false); assert.equal(store.sha, null);
  await assert.rejects(store.save({ note: 'Local' }), /读取/);
  assert.equal(calls.length, 2);
});

test('only a missing file in an existing initialized branch can be created without a SHA', async () => {
  const { store, calls } = fake(response(200, { default_branch: 'main' }), response(404, {}), response(200, { name: 'fictional-branch' }), response(201, { content: { sha: 'created' } }));
  assert.deepEqual(await store.prepare(), { exists: false });
  assert.ok(calls[2].url.endsWith('/branches/fictional-branch'));
  await store.save({ note: 'Fictional' });
  assert.equal(Object.hasOwn(JSON.parse(calls[3].options.body), 'sha'), false);
});

test('default branch is verified after a file 404, and omitted from write when not configured', async () => {
  const calls = [];
  const replies = [response(200, { default_branch: 'main' }), response(404, {}), response(200, { name: 'main' }), response(201, { content: { sha: 'created' } })];
  const store = new GithubStore({ ...settings, branch: '' }, async (url, options) => { calls.push({ url, options }); return replies.shift(); });
  await store.prepare(); await store.save({ note: 'Fictional' });
  assert.ok(!calls[1].url.includes('?ref=')); assert.ok(calls[2].url.endsWith('/branches/main'));
  assert.equal(Object.hasOwn(JSON.parse(calls[3].options.body), 'branch'), false);
});

test('repository 404 and branch 404 are failures, not permission to create a ledger', async () => {
  for (const replies of [
    [response(404, {})],
    [response(200, { default_branch: 'main' }), response(404, {}), response(404, {})]
  ]) {
    const { store, calls } = fake(...replies);
    await assert.rejects(store.prepare(), error => error.status === 404);
    assert.equal(store.loaded, false);
    await assert.rejects(store.save({}), /读取/);
    assert.ok(calls.every(c => c.options.method !== 'PUT'));
  }
});

test('uninitialized repositories do not permit saving', async () => {
  const calls = [];
  const replies = [response(200, { default_branch: '' }), response(404, {})];
  const store = new GithubStore({ ...settings, branch: '' }, async (url, options) => { calls.push({ url, options }); return replies.shift(); });
  await assert.rejects(store.prepare(), /初始化/);
  assert.equal(store.loaded, false); assert.equal(calls.length, 2);
});

test('409 conflict stops writes and requires another read; local data remains unchanged', async () => {
  const data = { note: 'Local fictional change' }; const original = structuredClone(data);
  const { store, calls } = fake(response(200, file({ note: 'Cloud' })), response(409, {}));
  await store.read(); await assert.rejects(store.save(data), error => error.status === 409 && /停止覆盖/.test(error.message));
  assert.deepEqual(data, original); assert.equal(store.loaded, false);
  await assert.rejects(store.save(data), /读取/); assert.equal(calls.length, 2);
});

test('401, 403 and network errors preserve input and do not allow blind retries', async () => {
  for (const failure of [response(401, {}), response(403, {}), new Error('Offline')]) {
    const { store, calls } = fake(response(200, file({})), failure);
    const data = { note: 'Fictional' }; await store.read();
    await assert.rejects(store.save(data)); assert.deepEqual(data, { note: 'Fictional' });
    assert.equal(store.loaded, false); assert.equal(calls.length, 2);
  }
});

test('malformed JSON and non-file responses invalidate a previously loaded revision', async () => {
  for (const invalid of [
    { type: 'file', encoding: 'base64', sha: 'bad', content: encode('{bad JSON') },
    { type: 'dir', encoding: 'base64', sha: 'bad', content: '' }
  ]) {
    const { store, calls } = fake(response(200, file({})), response(200, invalid));
    await store.read(); await assert.rejects(store.read());
    assert.equal(store.loaded, false); assert.equal(store.sha, null);
    await assert.rejects(store.save({}), /读取/); assert.equal(calls.length, 2);
  }
});

test('config rejects invalid owner and traversal paths before any request', () => {
  for (const changes of [{ owner: '../owner' }, { repo: 'repo/name' }, { token: '' }, { path: '../data.json' }, { path: '/data.json' }, { path: 'folder//data.json' }]) {
    assert.throws(() => config({ ...settings, ...changes }));
  }
});
