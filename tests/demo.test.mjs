import test from 'node:test';
import assert from 'node:assert/strict';
import {MAINNET_DEMO} from '../dist/demo.mjs';
import {validateInvoice,hashValue,fingerprint} from '../dist/core.mjs';
test('mainnet demo uses the builder-provided request and matching digest, without trusting a cached paid result',async()=>{
  const i=validateInvoice(MAINNET_DEMO.invoice);
  assert.equal(i.chainId,5042);assert.equal(i.amount,'1');
  assert.equal(hashValue(MAINNET_DEMO.hash),MAINNET_DEMO.hash);
  assert.equal(await fingerprint(i),'33d2263f9d4e148f4e83694d4d4511ba5d8774ef366224c906fbc4af0e1fbd07');
  assert.equal(Object.hasOwn(MAINNET_DEMO,'result'),false);
});
