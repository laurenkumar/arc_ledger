import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedTransferHash} from '../dist/workspace.mjs';

const hash = '0x' + 'a'.repeat(64);
const invoice = {id:'AL-REQUEST',chainId:5042};

test('recorded transfer survives reload as a hash to recheck, without a paid claim',()=>{
  const restored = JSON.parse(JSON.stringify({invoices:[invoice],assignments:{['5042:'+hash]:invoice.id}}));
  assert.equal(recordedTransferHash(restored.invoices[0],restored.assignments),hash);
  assert.equal(restored.receipts,undefined);
});

test('a different request, network or invalid hash cannot supply the recorded transfer',()=>{
  const assignments = {['5042002:'+hash]:invoice.id,['5042:'+hash]:'AL-OTHER','5042:0xmalformed':invoice.id};
  assert.equal(recordedTransferHash(invoice,assignments),null);
  assert.equal(recordedTransferHash(null,assignments),null);
  assert.equal(recordedTransferHash(invoice,{}),null);
});
