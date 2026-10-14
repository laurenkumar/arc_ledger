export const NETWORKS = Object.freeze({
  5042: Object.freeze({id:5042,name:'Arc Mainnet',rpc:'https://rpc.mainnet.arc.io',explorer:'https://explorer.arc.io'}),
  5042002: Object.freeze({id:5042002,name:'Arc Testnet',rpc:'https://rpc.testnet.arc.io',explorer:'https://explorer.testnet.arc.io'})
});
export const ZERO = '0x'+'0'.repeat(40);
export const MIN_MAX_FEE = 20_000_000_000n;
export const MAX_FEE_BUDGET = 50_000_000_000_000_000n; // 0.05 native USDC
export function address(value) {
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value)||value.toLowerCase()===ZERO)throw new Error('Enter a non-zero EVM wallet address (0x + 40 hexadecimal characters).');
  return value.toLowerCase();
}
export function amountUnits(value) {
  if(typeof value!=='string'||!/^\d{1,10}(\.\d{1,6})?$/.test(value))throw new Error('Use a positive USDC amount with at most 6 decimal places.');
  const [whole,part='']=value.split('.');
  const n=BigInt(whole)*10n**18n+BigInt(part.padEnd(18,'0'));
  if(n<=0n||n>1_000_000_000n*10n**18n)throw new Error('Amount must be greater than zero and at most 1 billion USDC.');
  return n;
}
export function formatUnits(n, precision=6) {
  n=BigInt(n);if(n<0n)throw new Error('Negative amount.');
  const scale=10n**18n,whole=n/scale,part=(n%scale).toString().padStart(18,'0').slice(0,precision).replace(/0+$/,'');
  return whole.toString()+(part?'.'+part:'');
}
export function quantity(n) {return '0x'+BigInt(n).toString(16);}
export function hexQuantity(value) {
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]+$/.test(value))throw new Error('RPC returned an invalid quantity.');
  return BigInt(value);
}
export function hashValue(value) {
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new Error('Enter a transaction hash (0x + 64 hexadecimal characters).');
  return value.toLowerCase();
}
export function validateInvoice(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid payment request.');
  if(input.version!==1||!Object.hasOwn(NETWORKS,input.chainId))throw new Error('Unsupported payment request or network.');
  if(typeof input.id!=='string'||!/^AL-[A-Z0-9]{12}$/.test(input.id))throw new Error('Invalid request ID.');
  if(typeof input.reference!=='string'||input.reference.length<1||input.reference.length>80||/[\x00-\x1f\x7f]/.test(input.reference))throw new Error('Reference must contain 1–80 printable characters.');
  if(!Number.isSafeInteger(input.createdAt)||!Number.isSafeInteger(input.expiresAt)||input.createdAt<0||input.expiresAt<=input.createdAt||input.expiresAt-input.createdAt>90*86400000)throw new Error('Invalid expiry date.');
  const invoice={version:1,id:input.id,chainId:Number(input.chainId),recipient:address(input.recipient),amount:formatUnits(amountUnits(input.amount)),reference:input.reference,createdAt:input.createdAt,expiresAt:input.expiresAt};
  if(input.expectedPayer!==undefined){invoice.expectedPayer=address(input.expectedPayer);if(invoice.expectedPayer===invoice.recipient)throw new Error('Expected payer must be different from the recipient.');}
  return invoice;
}
export function createInvoice({recipient,amount,reference,chainId=5042002,expectedPayer},now=Date.now()) {
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  const id='AL-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  return validateInvoice({version:1,id,recipient,amount,reference:reference.trim(),chainId:Number(chainId),createdAt:now,expiresAt:now+30*86400000,...(expectedPayer?{expectedPayer}:{})});
}
export function canonical(invoice) {return JSON.stringify(validateInvoice(invoice));}
export async function fingerprint(invoice) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(invoice)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function memoData(invoice) {
  // Compatibility with receipts from earlier versions only. New payments carry
  // no calldata, so MetaMask can send them to another account in the same wallet.
  const message='arc-ledger:v1:'+await fingerprint(invoice);
  return '0x'+Array.from(new TextEncoder().encode(message),b=>b.toString(16).padStart(2,'0')).join('');
}
export function encodeInvoice(invoice) {
  const bytes=new TextEncoder().encode(canonical(invoice));
  return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeInvoice(encoded) {
  if(typeof encoded!=='string'||encoded.length>3000||!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error('Invalid payment link.');
  try {return validateInvoice(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}catch{throw new Error('This payment link is malformed or unsupported.');}
}
export function paymentLink(invoice,base) {
  const u=new URL(base);if(!['http:','https:'].includes(u.protocol))throw new Error('Unsupported share URL.');
  u.search='';u.hash='pay='+encodeInvoice(invoice);return u.href;
}
export async function rpc(chainId,method,params=[],fetcher=fetch) {
  const network=NETWORKS[chainId];if(!network)throw new Error('Unsupported network.');
  const res=await fetcher(network.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error('The Arc RPC is unavailable. Try again later.');
  const body=await res.json();if(body.error)throw new Error(typeof body.error.message==='string'?body.error.message:'RPC request failed.');
  if(!Object.hasOwn(body,'result'))throw new Error('RPC returned no result.');return body.result;
}
export async function verifyReceipt(invoice,hash,request=(m,p)=>rpc(invoice.chainId,m,p)) {
  invoice=validateInvoice(invoice);hash=hashValue(hash);
  const chain=await request('eth_chainId',[]);
  if(hexQuantity(chain)!==BigInt(invoice.chainId))throw new Error('RPC network does not match the request.');
  const [tx,receipt]=await Promise.all([request('eth_getTransactionByHash',[hash]),request('eth_getTransactionReceipt',[hash])]);
  if(!tx||!receipt)return {status:'pending',hash,chainId:invoice.chainId,reason:'Transaction not found or not yet included. No payment has been confirmed.'};
  if(hashValue(tx.hash)!==hash||hashValue(receipt.transactionHash)!==hash)throw new Error('RPC returned a mismatched transaction.');
  if(hexQuantity(receipt.status)!==1n)return {status:'failed',hash,chainId:invoice.chainId,reason:'The transaction reverted. This request is unpaid.'};
  if(!tx.blockHash||!receipt.blockHash||!tx.blockNumber||!receipt.blockNumber)return {status:'pending',hash,chainId:invoice.chainId,reason:'Transaction inclusion is not confirmed.'};
  if(hashValue(tx.blockHash)!==hashValue(receipt.blockHash)||hexQuantity(tx.blockNumber)!==hexQuantity(receipt.blockNumber))throw new Error('Transaction and receipt block mismatch.');
  if(tx.chainId&&hexQuantity(tx.chainId)!==BigInt(invoice.chainId))throw new Error('Transaction belongs to another chain.');
  if(address(tx.to)!==invoice.recipient)return {status:'mismatch',reason:'Recipient does not match this request.',hash,chainId:invoice.chainId};
  if(hexQuantity(tx.value)!==amountUnits(invoice.amount))return {status:'mismatch',reason:'Transferred amount does not match this request.',hash,chainId:invoice.chainId};
  const from=address(tx.from);
  if(from===invoice.recipient)return {status:'mismatch',reason:'A self-transfer is not a received payment from a payer.',hash,chainId:invoice.chainId};
  if(invoice.expectedPayer&&from!==invoice.expectedPayer)return {status:'mismatch',reason:'Sender does not match the expected payer address.',hash,chainId:invoice.chainId};
  if(typeof tx.input!=='string')throw new Error('RPC returned invalid transaction input.');
  const input=tx.input.toLowerCase(),binding=input==='0x'?'transfer':'reference';
  if(binding==='reference'&&input!==await memoData(invoice))return {status:'mismatch',reason:'This transfer contains data that does not match the request. Standard payments must have empty data.',hash,chainId:invoice.chainId};
  const block=await request('eth_getBlockByHash',[receipt.blockHash,false]);
  if(!block||hashValue(block.hash)!==hashValue(receipt.blockHash)||hexQuantity(block.number)!==hexQuantity(receipt.blockNumber))throw new Error('Included block could not be independently verified.');
  const timestamp=Number(hexQuantity(block.timestamp))*1000;
  if(!Number.isSafeInteger(timestamp)||timestamp>invoice.expiresAt||timestamp<invoice.createdAt-60000)return {status:'mismatch',reason:'Payment timestamp is outside this request’s validity window.',hash,chainId:invoice.chainId};
  const fee=hexQuantity(receipt.gasUsed)*hexQuantity(receipt.effectiveGasPrice);
  return {status:'paid',hash,chainId:invoice.chainId,from,to:invoice.recipient,amount:invoice.amount,fee:formatUnits(fee,18),blockNumber:hexQuantity(receipt.blockNumber).toString(),timestamp,fingerprint:await fingerprint(invoice),binding,reason:binding==='reference'?'Transfer and legacy on-chain request reference verified.':'Transfer verified on-chain. This standard transfer has no on-chain request reference; its association with this request is your bookkeeping choice.',verifiedAt:Date.now()};
}
export function assertReceiptAssignment(invoice,result,assignments={}) {
  if(result.status!=='paid')return;
  invoice=validateInvoice(invoice);
  if(result.chainId!==invoice.chainId)throw new Error('Receipt assignment network mismatch.');
  const key=invoice.chainId+':'+hashValue(result.hash),assigned=assignments[key];
  if(assigned&&assigned!==invoice.id)throw new Error('This transaction is already assigned to another request in this browser. One transfer cannot settle two requests.');
}
export async function preparePayment(invoice,from,request,now=Date.now()) {
  invoice=validateInvoice(invoice);from=address(from);
  if(now>invoice.expiresAt)throw new Error('This request has expired.');
  if(now<invoice.createdAt-60000)throw new Error('Request creation time is in the future.');
  if(from===invoice.recipient)throw new Error('Use a different wallet to pay this request.');
  if(invoice.expectedPayer&&from!==invoice.expectedPayer)throw new Error('Connect the expected payer account: '+invoice.expectedPayer+'.');
  if(hexQuantity(await request('eth_chainId',[]))!==BigInt(invoice.chainId))throw new Error('Switch your wallet to '+NETWORKS[invoice.chainId].name+'.');
  if(await request('eth_getCode',[invoice.recipient,'latest'])!=='0x')throw new Error('This version supports regular recipient wallets only. Contract recipients are not supported.');
  const draft={from,to:invoice.recipient,chainId:quantity(invoice.chainId),value:quantity(amountUnits(invoice.amount))};
  // A newly added network often has no funds yet. Report that before asking
  // eth_estimateGas, which otherwise returns an opaque insufficient-funds error.
  const balance=hexQuantity(await request('eth_getBalance',[from,'latest']));
  if(balance<=amountUnits(invoice.amount))throw new Error('Insufficient USDC on '+NETWORKS[invoice.chainId].name+': payer balance '+formatUnits(balance,18)+' USDC. You need '+invoice.amount+' USDC plus the network fee.'+(invoice.chainId===5042002?' Get test USDC from the Circle faucet for this payer account.':''));
  const [gasResult,priceResult]=await Promise.all([request('eth_estimateGas',[draft]),request('eth_gasPrice',[])]);
  const gas=hexQuantity(gasResult)*120n/100n;
  const price=hexQuantity(priceResult)*2n,maxFeePerGas=price>MIN_MAX_FEE?price:MIN_MAX_FEE;
  const maxFee=gas*maxFeePerGas;
  if(gas<=0n||maxFee>MAX_FEE_BUDGET)throw new Error('Estimated fee exceeds the 0.05 USDC limit. Payment was not sent.');
  if(balance<amountUnits(invoice.amount)+maxFee)throw new Error('Insufficient USDC for payment plus maximum gas fee: payer balance '+formatUnits(balance,18)+' USDC; required '+formatUnits(amountUnits(invoice.amount)+maxFee,18)+' USDC.');
  return {transaction:{...draft,gas:quantity(gas),maxFeePerGas:quantity(maxFeePerGas),maxPriorityFeePerGas:'0x0'},maximumFee:formatUnits(maxFee,18)};
}
