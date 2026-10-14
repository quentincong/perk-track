'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const R = require('../reports.js');
const { ledger, point, today } = require('./fixtures.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('point promotions are separate from reimbursements and cannot cover an annual fee', () => {
  const d = ledger(); d.cards[0].annualFee = 80;
  d.points = [
    point('promotion', 'earn', { amount: 15000, cardId: 'fictional-card', incomeBucket: 'perk', source: 'transfer-bonus' }),
    point('spend', 'earn', { amount: 10000, cardId: 'fictional-card', incomeBucket: 'spend' }),
    point('sub', 'earn', { amount: 20000, cardId: 'fictional-card', incomeBucket: 'sub' })
  ];
  d.perks = [{ id: 'hotel', name: 'Fictional unused hotel credit', cardId: 'fictional-card', cycle: 'annual', allowance: 150 }];
  d.costs = [{ id: 'fee', name: 'Fictional annual fee', kind: 'annual-fee', bucket: 'perk', cardId: 'fictional-card', date: '2026-06-01', amount: 80, amountConfirmed: true }];
  const r = R.report(d, 'all', today), coverage = R.cardBenefits(d, 'all', today)[0];
  close(r.cards[0].extraPoints, 270); close(r.cards[0].benefitNet, -80);
  close(r.totals.benefits, -80); close(r.totals.extraPoints, 270);
  assert.equal(coverage.recognized, 0); assert.equal(coverage.net, -80); assert.equal(coverage.covered, false);
  assert.equal(coverage.perks[0].progress.remaining, 150);
  close(r.cards[0].sources.reduce((n, s) => n + s.amount, 0), r.cards[0].total);
  const source = r.cards[0].sources.find(s => s.recordId === 'promotion');
  assert.equal(source.collection, 'points'); assert.equal(source.program, 'Aeroplan'); assert.equal(source.cpp, 1.8);
});

test('fee coverage uses confirmed used personal value, not allowances, starting prices or pending credits', () => {
  const d = ledger(); d.cards[0].annualFee = 80;
  d.perks = [
    { id: 'credit', name: 'Fictional reimbursement', cardId: 'fictional-card', cycle: 'annual', allowance: 100 },
    { id: 'service', name: 'Fictional shared service', cardId: 'fictional-card', cycle: 'annual', benefitType: 'service', referencePrice: 40 }
  ];
  d.usages = [
    { id: 'paid', perkId: 'credit', date: '2026-06-01', faceUsed: 60, actualValue: 60, posted: true, valueStatus: 'confirmed' },
    { id: 'pending', perkId: 'credit', date: '2026-07-01', faceUsed: 20, actualValue: 20, posted: false },
    { id: 'shared', perkId: 'service', date: '2026-06-01', quantity: 2, referenceValue: 40, actualValue: null, overlapConfirmed: true, usageConfirmed: true }
  ];
  d.costs = [{ id: 'fee', name: 'Fee', cardId: 'fictional-card', date: '2026-06-01', amount: 80, kind: 'annual-fee', amountConfirmed: true }];
  let c = R.cardBenefits(d, 'all', today)[0];
  assert.equal(c.recognized, 60); assert.equal(c.pendingValue, 20); assert.equal(c.referenceValue, 40);
  assert.equal(c.net, -20); assert.equal(c.covered, false); assert.equal(c.perks[1].uses, 2);
  d.usages[1].posted = true;
  c = R.cardBenefits(d, 'all', today)[0]; assert.equal(c.net, 0); assert.equal(c.covered, true);
  d.usages[2].actualValue = 40;
  c = R.cardBenefits(d, 'all', today)[0]; assert.equal(c.recognized, 80); assert.equal(c.overlapValue, 40);
  d.usages[2].cardAttributionValue = 15;
  c = R.cardBenefits(d, 'all', today)[0]; assert.equal(c.recognized, 95); assert.equal(c.net, 15);
  d.usages[2].cardAttributionValue = 45; assert.throws(() => C.validate(d), /归属价值/);
});

test('unrecorded or estimated fees cannot certify a negative annual fee', () => {
  const d = ledger(); d.cards[0].annualFee = 80;
  let c = R.cardBenefits(d, 'all', today)[0]; assert.equal(c.net, null); assert.equal(c.covered, null);
  d.costs = [{ id: 'fee', name: 'Estimated fee', cardId: 'fictional-card', date: '2026-06-01', amount: 80, kind: 'annual-fee', amountConfirmed: false }];
  c = R.cardBenefits(d, 'all', today)[0]; assert.equal(c.net, null); assert.equal(c.covered, null);
});

test('each currency has an asset assumption and weighted realized CPP; unknown taxes are excluded', () => {
  const d = ledger(); d.settings.valuations.MilesB = 1.2;
  d.points = [
    point('a-snapshot', 'balance', { amount: 9000 }),
    point('a-redemption', 'redeem', { date: '2026-06-02', amount: 2000, cashReference: 50, taxes: 10 }),
    point('a-larger', 'redeem', { date: '2026-06-03', amount: 4000, cashReference: 140, taxes: 20 }),
    point('b-snapshot', 'balance', { program: 'MilesB', amount: 3000 }),
    point('b-unknown', 'redeem', { program: 'MilesB', date: '2026-06-02', amount: 500, cashReference: 50, taxes: null })
  ];
  let programs = R.pointPrograms(d, 'all', today);
  let a = programs.find(p => p.program === 'Aeroplan'), b = programs.find(p => p.program === 'MilesB');
  assert.equal(a.balance, 3000); close(a.assetValue, 54); close(a.realizedCpp, 160 / 6000 * 100);
  assert.equal(a.netRedemptionValue, 160); assert.equal(a.balanceSource.id, 'a-snapshot');
  assert.equal(b.balance, 2500); assert.equal(b.unpriced, 1); assert.equal(b.realizedCpp, null);
  assert.equal(programs.find(p => p.program === 'UR').balanceStatus, 'untracked');
  d.settings.valuations.Aeroplan = 2;
  programs = R.pointPrograms(d, 'all', today); a = programs.find(p => p.program === 'Aeroplan');
  close(a.assetValue, 60); close(a.realizedCpp, 160 / 6000 * 100);
  const filtered = R.pointPrograms(d, 2025, today).find(p => p.program === 'Aeroplan');
  assert.equal(filtered.balance, 3000); assert.equal(filtered.netRedemptionValue, 0);
});

test('refunds reverse the weighted redemption metric and missing valuations do not imply zero asset value', () => {
  const d = ledger(); delete d.settings.valuations.Aeroplan;
  d.points = [
    point('balance', 'balance', { amount: 10000 }),
    point('redemption', 'redeem', { date: '2026-06-02', amount: 4000, cashReference: 100, taxes: 20 }),
    point('refund', 'refund', { date: '2026-06-03', amount: 4000, cashReference: 100, taxes: 20 })
  ];
  const p = R.pointPrograms(d, 'all', today).find(p => p.program === 'Aeroplan');
  assert.equal(p.balance, 10000); assert.equal(p.assetValue, null); assert.equal(p.realizedCpp, null);
  assert.equal(p.netRedemptionValue, 0); assert.equal(p.pricedPoints, 0);
});

test('bank net can be traced to receipts, costs and computed occupancy without counting principal as income', () => {
  const d = ledger(); d.settings.opportunityRate = 3.65;
  d.banks = [{ id: 'bank', name: 'Fictional bank', openDate: '2026-01-01', capitalComplete: true }];
  d.bankEvents = [
    { id: 'deposit', bankId: 'bank', date: '2026-01-01', type: 'deposit', amount: 1000 },
    { id: 'bonus', bankId: 'bank', date: '2026-01-10', type: 'bonus', amount: 200 },
    { id: 'fee', bankId: 'bank', date: '2026-01-10', type: 'fee', amount: 5 }
  ];
  const b = R.report(d, 'all', '2026-01-10').bankRows[0];
  close(b.sources.reduce((n, s) => n + s.amount, 0), b.net);
  assert.ok(!b.sources.some(s => s.recordId === 'deposit'));
  const occupancy = b.sources.find(s => s.kind === 'opportunity');
  assert.equal(occupancy.collection, 'banks'); assert.equal(occupancy.dollarDays, 10000);
});
