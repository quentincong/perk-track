'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const R = require('../reports.js');
const { ledger, point, today } = require('./fixtures.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('checking, savings and card income stay separate; each card has three net buckets', () => {
  const d = ledger();
  d.banks = ['checking', 'savings'].map(type => ({ id: type, name: `Fictional ${type}`, accountType: type, openDate: '2026-01-01' }));
  d.bankEvents = [
    { id: 'deposit', bankId: 'checking', date: '2026-01-01', type: 'deposit', amount: 1000 },
    { id: 'checking-bonus', bankId: 'checking', date: '2026-06-01', type: 'bonus', amount: 200 },
    { id: 'savings-bonus', bankId: 'savings', date: '2026-06-01', type: 'bonus', amount: 300 }
  ];
  d.points = [
    point('spend', 'earn', { cardId: 'fictional-card', incomeBucket: 'spend', amount: 1000, category: 'tuition' }),
    point('sub', 'earn', { cardId: 'fictional-card', incomeBucket: 'sub', amount: 40000 })
  ];
  d.perks = [{ id: 'perk', name: 'Fictional credit', cardId: 'fictional-card', cycle: 'annual', allowance: 100 }];
  d.usages = [{ id: 'usage', perkId: 'perk', date: '2026-06-01', faceUsed: 100, actualValue: 60 }];
  d.costs = [
    { id: 'fee', name: 'Paid annual fee', date: '2026-06-01', amount: 95, cardId: 'fictional-card', bucket: 'perk' },
    { id: 'tuition-fee', name: 'Payment fee', date: '2026-06-01', amount: 403.2, paymentBase: 16000, feePercent: 2.52, cardId: 'fictional-card', bucket: 'sub' },
    { id: 'induced', name: 'Unnecessary purchase loss', date: '2026-06-01', amount: 10, cardId: 'fictional-card', bucket: 'sub' },
    { id: 'foregone', name: 'Foregone rewards', date: '2026-06-01', amount: 20, cardId: 'fictional-card', bucket: 'sub' }
  ];
  const r = R.report(C.validate(d), 'all', today);
  close(r.cards[0].spend, 18); close(r.cards[0].perks, -35); close(r.cards[0].sub, 286.8);
  close(r.totals.cards, 269.8); close(r.totals.bank, 500); close(r.totals.combined, 769.8);
  assert.equal(r.bankTypes.checking, 200); assert.equal(r.bankTypes.savings, 300);
  assert.equal(r.byCategory.tuition.value, 18);
});

test('tuition principal is not a loss; scenario keeps regular rewards separate and does not post income', () => {
  const d = ledger(); const original = structuredClone(d);
  d.settings.valuations.Aeroplan = 1.5;
  const s = R.subScenario(d, { cardId: 'fictional-card', bonusPoints: 40000, paymentAmount: 16000 });
  close(s.fee, 403.2); close(s.subNet, 196.8); close(s.normalValue, 240); close(s.net, 436.8);
  assert.deepEqual(d.points, original.points); assert.deepEqual(d.costs, original.costs);
  assert.equal(R.report(d, 'all', today).totals.cards, 0);
});

test('CPP defaults to 1.8 cents and changing it recomputes earnings and category comparisons', () => {
  const d = ledger(); assert.deepEqual(d.settings.valuations, { UR: 1.8, Aeroplan: 1.8 });
  d.points = [point('earn', 'earn', { program: 'UR', incomeBucket: 'spend', cardId: 'fictional-card', amount: 1000 })];
  d.rewardRules = [{ id: 'rule', cardId: 'fictional-card', category: 'dining', unit: 'points', rate: 3, program: 'UR' }];
  close(R.report(d, 'all', today).totals.spend, 18); close(R.bestCards(d, 'dining', today)[0].returnPercent, 5.4);
  d.settings.valuations.UR = 2;
  close(R.report(d, 'all', today).totals.spend, 20); close(R.bestCards(d, 'dining', today)[0].returnPercent, 6);
  assert.equal(C.balances(d, today).UR, undefined);
});

test('transfer principal, extra bonus, redemption and remaining assets are never added twice', () => {
  const d = ledger();
  d.points = [
    point('original', 'earn', { date: '2026-01-01', program: 'UR', amount: 50000, incomeBucket: 'spend', cardId: 'fictional-card' }),
    point('transfer', 'transfer', { program: 'UR', amount: 50000, targetProgram: 'Aeroplan', received: 60000 }),
    point('bonus', 'earn', { amount: 10000, incomeBucket: 'perk', cardId: 'fictional-card', affectsBalance: false, notes: 'Included in transfer.received' }),
    point('redeem', 'redeem', { date: '2026-06-02', amount: 25000, cashReference: 450, taxes: 50 })
  ];
  const r = R.report(C.validate(d), 'all', today);
  close(r.totals.spend, 900); close(r.totals.perks, 180); close(r.totals.cards, 1080);
  close(r.redemptionValue, 400); close(r.remainingValuation, 630);
  assert.equal(C.balances(d, today).Aeroplan, 35000);
});

test('balance snapshots earn no income; backfilled sources already included in them do not add balance', () => {
  const d = ledger();
  d.points = [
    point('snapshot', 'balance', { amount: 60000 }),
    point('backfill', 'earn', { date: '', periodYear: 2026, amount: 3000, affectsBalance: false, incomeBucket: 'spend', cardId: 'fictional-card' }),
    point('later-source', 'earn', { date: '2026-06-02', amount: 1000, affectsBalance: false, incomeBucket: 'spend', cardId: 'fictional-card' }),
    point('new-flight', 'earn', { date: '2026-07-01', amount: 500, incomeBucket: 'flight', cardId: 'fictional-card' })
  ];
  const r = R.report(C.validate(d), 2026, today);
  assert.equal(C.balances(d, today).Aeroplan, 60500);
  close(r.totals.spend, 72); close(r.totals.nonCard, 9); close(r.totals.cards, 72);
});

test('year-only sources with uncertain snapshot ordering hide balance until clarified', () => {
  const d = ledger();
  d.points = [point('snapshot', 'balance', { amount: 60000 }), point('year-only', 'earn', { date: undefined, periodYear: 2026, amount: 1000 })];
  assert.doesNotThrow(() => C.validate(d));
  assert.equal(C.balances(d, today).Aeroplan, undefined);
  d.points[1].affectsBalance = false;
  assert.equal(C.balances(d, today).Aeroplan, 60000);
});

test('redemption CPP requires known cash reference and USD taxes, including an explicit zero', () => {
  const d = ledger(); const p = point('redeem', 'redeem', { amount: 25000, cashReference: 450, taxesOriginal: 70, taxesCurrency: 'CAD' });
  assert.equal(C.cpp(p), null);
  p.taxes = null; assert.equal(C.cpp(p), null);
  p.taxes = 50; close(C.cpp(p), 1.6);
  p.taxes = 0; close(C.cpp(p), 1.8);
  delete p.cashReference; assert.equal(C.cpp(p), null);
  d.points = [p]; assert.equal(C.summary(d, 'all', today).unpricedRedemptions, 1);
  assert.equal(C.validate(d).points[0].taxesOriginal, 70);
});

test('service count and reference starting price do not substitute for personal recognized value', () => {
  const d = ledger();
  d.perks = [{ id: 'service', name: 'Fictional seat benefit', cardId: 'fictional-card', cycle: 'annual', benefitType: 'service', referencePrice: 100 }];
  d.usages = [{ id: 'seat', perkId: 'service', date: '2026-06-01', quantity: 2, faceUsed: null, actualValue: 30, notes: 'One use record; status overlaps card benefit' }];
  assert.equal(R.report(C.validate(d), 'all', today).totals.perks, 30);
});

test('pending SUB milestones earn no income; targets and unknown deadlines remain intact', () => {
  const d = ledger();
  d.cards[0].subStatus = 'pending';
  d.cards[0].subMilestones = [{ points: 40000, spendGoal: 16000, deadline: '', status: 'pending', cumulative: true }];
  const validated = C.validate(d);
  assert.equal(validated.cards[0].subMilestones[0].deadline, '');
  assert.equal(R.report(validated, 'all', today).totals.sub, 0);
  d.cards[0].subMilestones[0].deadline = '2026-02-30'; assert.throws(() => C.validate(d), /SUB/);
});

test('date-limited category promotions expire and unknown rules / CPP stay explicit', () => {
  const d = ledger();
  d.rewardRules = [
    { id: 'base', cardId: 'fictional-card', category: 'other', unit: 'points', rate: 1, program: 'Aeroplan' },
    { id: 'promo', cardId: 'fictional-card', category: 'dining', unit: 'points', rate: 5, program: 'Aeroplan', validFrom: '2026-06-01', validTo: '2026-06-30', unconfirmedExpiry: true, notes: 'Cap not confirmed' }
  ];
  close(R.bestCards(d, 'dining', '2026-06-30')[0].returnPercent, 9);
  assert.equal(R.bestCards(d, 'dining', '2026-06-30')[0].unconfirmed, true);
  close(R.bestCards(d, 'dining', '2026-07-01')[0].returnPercent, 1.8);
  delete d.settings.valuations.Aeroplan; assert.equal(R.bestCards(d, 'dining', today)[0].returnPercent, null);
  d.rewardRules = []; assert.equal(R.bestCards(d, 'dining', today)[0].rate, null);
});

test('a cash SUB offer is not counted again when its actual points arrive; unknown receipt year is not guessed', () => {
  const d = ledger(); Object.assign(d.cards[0], { subStatus: 'received', subCash: 200 });
  assert.equal(R.report(d, 'all', today).totals.sub, 200);
  assert.equal(R.report(d, 2026, today).totals.sub, 0);
  d.cards[0].subReceiptYear = 2026;
  assert.equal(R.report(d, 2026, today).totals.sub, 200);
  d.points = [point('actual-sub', 'earn', { program: 'UR', amount: 20000, cardId: 'fictional-card', incomeBucket: 'sub' })];
  close(R.report(d, 2026, today).totals.sub, 360);
  d.cards[0].subReceiptYear = 2026.5; assert.throws(() => C.validate(d), /到账年份/);
});

test('capital occupancy integrates deposits and withdrawals; incomplete capital is excluded', () => {
  const d = ledger(); const bank = { id: 'bank', name: 'Fictional savings', openDate: '2026-01-01' };
  d.banks = [bank]; d.settings.opportunityRate = 3.65;
  d.bankEvents = [
    { id: 'in', bankId: 'bank', date: '2026-01-01', type: 'deposit', amount: 1000 },
    { id: 'out', bankId: 'bank', date: '2026-01-11', type: 'withdrawal', amount: 500 },
    { id: 'bonus', bankId: 'bank', periodYear: 2026, type: 'bonus', amount: 200 }
  ];
  assert.doesNotThrow(() => C.validate(d));
  assert.equal(C.bankProgress(d, bank, today).bonus, 200);
  assert.equal(C.occupied(d, bank, '2026-01-01', '2026-01-21').dollarDays, 15000);
  close(C.summary(d, 'all', '2026-01-20').opportunity, 1.5);
  bank.capitalComplete = false;
  assert.deepEqual(C.occupied(d, bank, '2026-01-01', '2026-01-21'), { balance: null, dollarDays: 0 });
});

test('refund reverses redemption value; point purchases are deducted once in the legacy cash summary', () => {
  const d = ledger(); d.points = [
    point('buy', 'buy', { date: '2026-01-01', amount: 25000, purchaseCost: 200 }),
    point('redeem', 'redeem', { date: '2026-06-01', amount: 25000, cashReference: 450, taxes: 50 }),
    point('refund', 'refund', { date: '2026-06-02', amount: 25000, cashReference: 450, taxes: 50 })
  ];
  const s = C.summary(d, 'all', today);
  assert.equal(s.redemptions, 0); assert.equal(s.net, -200); assert.equal(s.balances.Aeroplan, 25000);
  assert.equal(R.report(d, 'all', today).totals.cards, 0);
});

test('monthly / semiannual / leap-day cycles are deterministic and unknown cycles are not fabricated', () => {
  assert.equal(C.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(C.period({ cycle: 'monthly' }, [], '2026-06-30').end, '2026-07-01');
  assert.equal(C.period({ cycle: 'semiannual' }, [], '2026-07-01').start, '2026-07-01');
  assert.equal(C.period({ cycle: 'anniversary', anchorDate: '2024-02-29' }, [], '2025-03-01').start, '2025-02-28');
  assert.deepEqual(C.period({ cycle: 'annual', cycleConfirmed: false }, [], today), { start: '', end: '', lastDay: '' });
  assert.deepEqual(C.period({ cycle: 'anniversary', cardId: 'unknown' }, [{ id: 'unknown', openUnknown: true }], today), { start: '', end: '', lastDay: '' });
});

test('imports reject duplicate IDs, dangling links and impossible dates without mutating the input', () => {
  const d = ledger(); const original = structuredClone(d);
  assert.deepEqual(C.validate(d), original);
  d.points = [point('duplicate', 'earn'), point('duplicate', 'earn')]; assert.throws(() => C.validate(d), /ID/);
  d.points = [point('missing-card', 'earn', { cardId: 'nonexistent' })]; assert.throws(() => C.validate(d), /关联/);
  d.points = [point('invalid-date', 'earn', { date: '2026-02-30' })]; assert.throws(() => C.validate(d), /日期/);
  d.points = [point('invalid-flag', 'earn', { affectsBalance: 'false' })]; assert.throws(() => C.validate(d), /布尔值/);
});
