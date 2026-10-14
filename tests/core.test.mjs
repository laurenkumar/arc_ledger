import test from 'node:test';
import assert from 'node:assert/strict';
import {NETWORKS,amountUnits,formatUnits,address,createInvoice,validateInvoice,canonical,decodeInvoice,encodeInvoice,fingerprint,memoData,quantity,paymentLink,rpc,verifyReceipt,preparePayment,MIN_MAX_FEE,assertReceiptAssignment} from '../dist/core.mjs';
const to='0x'+'1'.repeat(40),from='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64),now=1791964800000;
const invoice=createInvoice({recipient:to,amount:'25.012345',reference:'Mission éducation',chainId:5042},now);
async function fixture(overrides={}){const tx={hash,from,to,value:quantity(amountUnits(invoice.amount)),input:await memoData(invoice),chainId:'0x13b2',blockHash,blockNumber:'0x100'},receipt={transactionHash:hash,status:'0x1',blockHash,blockNumber:'0x100',gasUsed:'0x5208',effectiveGasPrice:quantity(MIN_MAX_FEE)};const values={eth_chainId:'0x13b2',eth_getTransactionByHash:tx,eth_getTransactionReceipt:receipt,eth_getBlockByHash:{hash:blockHash,number:'0x100',timestamp:quantity(now/1000)},...overrides};return async(m)=>values[m];}
test('network definitions use official Arc mainnet/testnet and native USDC',()=>{assert.equal(NETWORKS[5042].rpc,'https://rpc.mainnet.arc.io');assert.equal(NETWORKS[5042002].id,5042002);});
test('native USDC amounts use 18 decimals, not ERC-20 six',()=>{assert.equal(amountUnits('1'),10n**18n);assert.equal(amountUnits('0.000001'),10n**12n);assert.equal(formatUnits(amountUnits('025.012345')),invoice.amount);});
for(const input of ['0','-1','1e4','NaN','1.0000001','1,23',' 1','1.','Infinity','1000000001'])test('reject amount '+input,()=>assert.throws(()=>amountUnits(input)));
test('round trip 1000 varied amounts without floating point rounding',()=>{for(let n=1;n<=1000;n++){const s=(n*917).toString()+'.'+String((n*173)%1000000).padStart(6,'0');assert.equal(amountUnits(formatUnits(amountUnits(s))),amountUnits(s));}});
test('reject zero recipient and malformed address',()=>{assert.throws(()=>address('0x'+'0'.repeat(40)));assert.throws(()=>address('0x123'));assert.throws(()=>address('javascript:alert(1)'));});
test('normalize reference, safe payment link and unicode round trip',()=>{assert.equal(canonical(decodeInvoice(encodeInvoice(invoice))),canonical(invoice));assert.equal(new URL(paymentLink(invoice,'https://example.com/?x=1')).search,'');assert.throws(()=>paymentLink(invoice,'javascript:alert(1)'));});
test('reject unsupported networks, invalid expiry and malformed imported links',()=>{assert.throws(()=>validateInvoice({...invoice,chainId:1}));assert.throws(()=>validateInvoice({...invoice,expiresAt:invoice.createdAt}));assert.throws(()=>decodeInvoice('x'.repeat(4000)));assert.throws(()=>decodeInvoice('%%%'));assert.throws(()=>decodeInvoice('a'));});
test('different requests cannot reuse same fingerprint',async()=>{const second=createInvoice({recipient:to,amount:invoice.amount,reference:invoice.reference,chainId:5042},now);assert.notEqual(await fingerprint(second),await fingerprint(invoice));});
test('valid receipt checked against tx, successful inclusion and reference',async()=>{const r=await verifyReceipt(invoice,hash,await fixture());assert.equal(r.status,'paid');assert.equal(r.amount,invoice.amount);assert.equal(r.fee,'0.00042');});
test('pending tx is never marked paid',async()=>{assert.equal((await verifyReceipt(invoice,hash,await fixture({eth_getTransactionReceipt:null}))).status,'pending');});
test('reverted receipt is never marked paid',async()=>{const request=await fixture();const receipt=await request('eth_getTransactionReceipt');receipt.status='0x0';assert.equal((await verifyReceipt(invoice,hash,request)).status,'failed');});
test('wrong recipient rejected',async()=>{const req=await fixture();(await req('eth_getTransactionByHash')).to=from;assert.equal((await verifyReceipt(invoice,hash,req)).status,'mismatch');});
test('wrong amount rejected even with successful receipt',async()=>{const req=await fixture();(await req('eth_getTransactionByHash')).value='0x1';assert.equal((await verifyReceipt(invoice,hash,req)).status,'mismatch');});
test('a legacy memo referring to another request is rejected',async()=>{const req=await fixture();const other=createInvoice({recipient:to,amount:invoice.amount,reference:'Another request',chainId:5042},now);(await req('eth_getTransactionByHash')).input=await memoData(other);assert.equal((await verifyReceipt(invoice,hash,req)).status,'mismatch');});
test('wrong chain and RPC receipt hash refused',async()=>{await assert.rejects(verifyReceipt(invoice,hash,await fixture({eth_chainId:'0x1'})));const req=await fixture();(await req('eth_getTransactionReceipt')).transactionHash=blockHash;await assert.rejects(verifyReceipt(invoice,hash,req));});
test('receipt and transaction block mismatch refused',async()=>{const req=await fixture();(await req('eth_getTransactionReceipt')).blockNumber='0x99';await assert.rejects(verifyReceipt(invoice,hash,req));});
test('missing inclusion information remains pending',async()=>{const req=await fixture();(await req('eth_getTransactionByHash')).blockHash=null;assert.equal((await verifyReceipt(invoice,hash,req)).status,'pending');});
test('receipt outside validity window refused',async()=>{const req=await fixture();(await req('eth_getBlockByHash')).timestamp=quantity((invoice.expiresAt+10000)/1000);assert.equal((await verifyReceipt(invoice,hash,req)).status,'mismatch');});
test('RPC error, http error and missing result become failures',async()=>{await assert.rejects(rpc(5042,'eth_chainId',[],async()=>({ok:false})));await assert.rejects(rpc(5042,'eth_chainId',[],async()=>({ok:true,json:async()=>({error:{message:'denied'}})})));await assert.rejects(rpc(5042,'eth_chainId',[],async()=>({ok:true,json:async()=>({})})));});
function payReq(overrides={}){const d={eth_chainId:'0x13b2',eth_getCode:'0x',eth_estimateGas:'0x6000',eth_gasPrice:'0x1',eth_getBalance:quantity(100n*10n**18n),...overrides};return async method=>d[method];}
test('payment applies Arc 20 gwei floor and exact native value',async()=>{const p=await preparePayment(invoice,from,payReq(),now);assert.equal(BigInt(p.transaction.maxFeePerGas),MIN_MAX_FEE);assert.equal(BigInt(p.transaction.value),amountUnits(invoice.amount));assert.equal(p.transaction.from,from);});
test('insufficient balance, high fees, wrong chain and contract recipient refused',async()=>{for(const change of [{eth_getBalance:'0x0'},{eth_gasPrice:quantity(10n**18n)},{eth_chainId:'0x1'},{eth_getCode:'0x1234'}])await assert.rejects(preparePayment(invoice,from,payReq(change),now));});
test('expired invoice and self-payment refused before payment submission',async()=>{await assert.rejects(preparePayment(invoice,from,payReq(),invoice.expiresAt+1));await assert.rejects(preparePayment(invoice,to,payReq(),now));});
test('native payment has no calldata, including for an existing legacy request',async()=>{
  const prepared=await preparePayment(invoice,from,payReq(),now);
  assert.equal(Object.hasOwn(prepared.transaction,'data'),false);
  assert.equal(Object.hasOwn(prepared.transaction,'input'),false);
});
test('external standard transfer is verified without access to the sender wallet',async()=>{
  const sender='0x'+'3'.repeat(40),req=await fixture(),methods=[];
  const tx=await req('eth_getTransactionByHash');tx.input='0x';tx.from=sender;
  const result=await verifyReceipt(invoice,hash,async(m,p)=>{methods.push(m);return req(m,p);});
  assert.equal(result.status,'paid');assert.equal(result.from,sender);assert.equal(result.binding,'transfer');
  assert.match(result.reason,/bookkeeping choice/);
  assert.deepEqual([...new Set(methods)].sort(),['eth_chainId','eth_getBlockByHash','eth_getTransactionByHash','eth_getTransactionReceipt'].sort());
});
test('legacy on-chain reference remains verifiable and is distinguished from a standard transfer',async()=>{
  const result=await verifyReceipt(invoice,hash,await fixture());assert.equal(result.binding,'reference');
});
test('known expected payer is preserved in shared links and checked against the actual sender',async()=>{
  const withPayer=validateInvoice({...invoice,expectedPayer:from});
  assert.equal(decodeInvoice(encodeInvoice(withPayer)).expectedPayer,from);
  const req=await fixture();(await req('eth_getTransactionByHash')).input='0x';
  assert.equal((await verifyReceipt(withPayer,hash,req)).status,'paid');
  (await req('eth_getTransactionByHash')).from='0x'+'3'.repeat(40);
  assert.equal((await verifyReceipt(withPayer,hash,req)).status,'mismatch');
});
test('wrong expected payer cannot prepare a transaction',async()=>{
  const withPayer=validateInvoice({...invoice,expectedPayer:'0x'+'3'.repeat(40)});
  await assert.rejects(preparePayment(withPayer,from,payReq(),now),/expected payer/);
  assert.throws(()=>validateInvoice({...invoice,expectedPayer:to}));
});
test('old links retain their canonical digest when no expected payer was specified',()=>{
  assert.equal(Object.hasOwn(validateInvoice(invoice),'expectedPayer'),false);
  assert.equal(canonical(decodeInvoice(encodeInvoice(invoice))),canonical(invoice));
});
test('self-transfer is not proof of receipt of a payment',async()=>{
  const req=await fixture(),tx=await req('eth_getTransactionByHash');tx.input='0x';tx.from=to;
  const result=await verifyReceipt(invoice,hash,req);assert.equal(result.status,'mismatch');assert.match(result.reason,/self-transfer/);
});
test('one transfer cannot be assigned to two requests in the same workspace',async()=>{
  const result=await verifyReceipt(invoice,hash,await fixture());
  const assignments={[invoice.chainId+':'+hash]:invoice.id};
  assert.doesNotThrow(()=>assertReceiptAssignment(invoice,result,assignments));
  const other=createInvoice({recipient:to,amount:invoice.amount,reference:invoice.reference,chainId:5042},now);
  assert.throws(()=>assertReceiptAssignment(other,result,assignments),/already assigned/);
  assert.doesNotThrow(()=>assertReceiptAssignment({...other,chainId:5042002},{...result,chainId:5042002},assignments));
});
