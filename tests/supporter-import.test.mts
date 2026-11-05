import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, validateSupporterCsv } from '../lib/supporter-import.ts';

test('supporter CSV handles quoted fields, tags, address, and historical amounts', () => {
  const csv = 'first_name,last_name,email,tags,notes,historical_contribution_amount,historical_contribution_date\nAvery,Reed,AVERY@EXAMPLE.ORG,"gala,returning","Met at the gala, 2025",1000.50,2025-04-12\n';
  assert.equal(parseCsv(csv)[1][4], 'Met at the gala, 2025');
  const result = validateSupporterCsv(csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].email, 'avery@example.org');
  assert.equal(result.rows[0].fullName, 'Avery Reed');
  assert.deepEqual(result.rows[0].tags, ['gala','returning']);
  assert.equal(result.rows[0].historicalContributionCents, 100_050);
});

test('supporter CSV reports understandable row-level validation errors', () => {
  const result = validateSupporterCsv('email,full_name,historical_contribution_amount\nnot-an-email,,minus\n');
  assert.equal(result.errors.length, 3);
  assert.deepEqual(result.errors.map(error => error.field), ['email','name','historical_contribution_amount']);
});
