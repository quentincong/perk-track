'use strict';
const C = require('../core.js');
function ledger() {
  const data = C.blank();
  data.settings.opportunityRate = 0;
  data.cards.push({ id: 'fictional-card', name: 'Fictional Travel Card', issuer: 'Fictional Bank', kind: 'personal', openDate: '2026-01-01', subProgram: 'Aeroplan' });
  return data;
}
function point(id, type, fields = {}) {
  return { id, type, date: '2026-06-01', program: 'Aeroplan', amount: 0, ...fields };
}
module.exports = { ledger, point, today: '2026-10-14' };
