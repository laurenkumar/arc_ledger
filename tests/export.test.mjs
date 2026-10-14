import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvoice} from '../dist/core.mjs';
import {prepareJSONExport,verifiedReceiptExport,saveJSONFile,attachJSONDownload} from '../dist/export.mjs';

const invoice=createInvoice({recipient:'0x'+'1'.repeat(40),amount:'1',reference:'Réception éducation',chainId:5042002});
const receipt={invoice,result:{status:'paid',hash:'0x'+'a'.repeat(64),chainId:5042002,amount:'1',binding:'transfer',fee:'0.00042',verifiedAt:Date.now()}};

test('receipt export preserves the exact JSON, Unicode reference and unsigned association warning',()=>{
  const exported=verifiedReceiptExport(receipt),data=JSON.parse(exported.text);
  assert.equal(exported.name,invoice.id+'-receipt.json');assert.equal(exported.type,'application/json');
  assert.equal(data.invoice.reference,invoice.reference);assert.deepEqual(data.result,receipt.result);
  assert.match(data.verification,/bookkeeping choice/);assert.match(data.verification,/unsigned/);
});
test('pending, failed, missing and wrong-network receipts cannot export as verified',()=>{
  for(const status of ['pending','failed','mismatch'])assert.throws(()=>verifiedReceiptExport({...receipt,result:{...receipt.result,status}}));
  assert.throws(()=>verifiedReceiptExport(null));
  assert.throws(()=>verifiedReceiptExport({...receipt,result:{...receipt.result,chainId:1}}));
});
test('JSON serialization errors are raised rather than silently initiating an empty download',()=>{
  assert.throws(()=>prepareJSONExport('bad.json',{amount:1n}));
  assert.throws(()=>prepareJSONExport('empty.json',undefined));
  assert.equal(prepareJSONExport('../receipt.json',{ok:true}).name,'.._receipt.json');
});
test('native save writes the complete JSON and reports success only after close',async()=>{
  const exported=verifiedReceiptExport(receipt),events=[];
  const picker=async options=>{
    assert.equal(options.suggestedName,exported.name);
    assert.deepEqual(options.types[0].accept,{'application/json':['.json']});
    return {createWritable:async()=>({write:async blob=>{events.push('write');assert.equal(blob.type,'application/json');assert.equal(await blob.text(),exported.text);},close:async()=>{events.push('close');}})};
  };
  assert.equal((await saveJSONFile(exported,picker)).status,'saved');assert.deepEqual(events,['write','close']);
});
test('cancelled, blocked and unavailable file pickers do not falsely report a saved receipt',async()=>{
  const exported=verifiedReceiptExport(receipt);
  assert.equal((await saveJSONFile(exported)).status,'unavailable');
  for(const [name,status]of [['AbortError','cancelled'],['SecurityError','blocked'],['NotAllowedError','blocked']]){
    assert.equal((await saveJSONFile(exported,async()=>{throw Object.assign(new Error(name),{name});})).status,status);
  }
});
test('disk write failure aborts and surfaces the error without a successful result',async()=>{
  let aborted=false;
  const picker=async()=>({createWritable:async()=>({write:async()=>{throw new Error('Disk full');},abort:async()=>{aborted=true;}})});
  await assert.rejects(saveJSONFile(verifiedReceiptExport(receipt),picker),/Disk full/);assert.equal(aborted,true);
});
test('download link retains a live blob URL until explicitly released',async()=>{
  const exported=verifiedReceiptExport(receipt),revoked=[],anchor={removeAttribute(name){delete this[name];}};
  let blob;
  const api={createObjectURL(value){blob=value;return 'blob:test';},revokeObjectURL(url){revoked.push(url);}};
  const release=attachJSONDownload(exported,anchor,api);
  assert.equal(anchor.href,'blob:test');assert.equal(anchor.download,exported.name);assert.equal(await blob.text(),exported.text);assert.deepEqual(revoked,[]);
  release();assert.deepEqual(revoked,['blob:test']);assert.equal(anchor.href,undefined);
});
