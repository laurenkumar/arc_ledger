import {NETWORKS,address,amountUnits,formatUnits,createInvoice,validateInvoice,canonical,paymentLink,decodeInvoice,verifyReceipt,hashValue,assertReceiptAssignment} from './core.mjs?v=1.4.2';
import {createWalletSession,walletErrorMessage} from './wallet.mjs?v=1.4.2';
import {prepareJSONExport,verifiedReceiptExport,saveJSONFile,attachJSONDownload} from './export.mjs?v=1.4.2';
import {MAINNET_DEMO} from './demo.mjs?v=1.4.2';
import {recordedTransferHash} from './workspace.mjs?v=1.4.2';
const $=id=>document.getElementById(id),STORE='arc-ledger-v1';
let invoices=[],receipts={},account=null,current=null,currentReceipt=null,provider=null,wallet=null,paymentBusy=false;
const broadcasts=new Map();
let assignments={};
try {const s=JSON.parse(localStorage.getItem(STORE)||'{}');if(Array.isArray(s.invoices))invoices=s.invoices.slice(0,200).map(validateInvoice);if(s.assignments&&typeof s.assignments==='object')for(const [key,id] of Object.entries(s.assignments)){if(/^(5042|5042002):0x[a-f0-9]{64}$/.test(key)&&invoices.some(i=>i.id===id&&key.startsWith(i.chainId+':')))assignments[key]=id;}/* Assignments are bookkeeping hints, never proof of payment. Reverify receipts after reload. */}catch{invoices=[];}
function notice(message,ok=false){$('notice').textContent=message;$('notice').hidden=false;$('notice').className=ok?'ok':'';}
function persist(){try{localStorage.setItem(STORE,JSON.stringify({invoices,assignments}));}catch{notice('Browser storage is unavailable. Export your request before leaving.');}}
function trackedHash(invoice){return invoice?(broadcasts.get(invoice.id)||recordedTransferHash(invoice,assignments)):null;}
function el(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function show(view){document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==view);document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));if(view==='verify')renderSelect();window.scrollTo({top:0,behavior:'smooth'});}
function action(label,fn,className='button ghost'){const b=el('button',label,className);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>notice(e.message)));return b;}
let activeExport=null,releaseExport=null,exportReturnFocus=null;
function closeExport(){
 if(!$('save-json').disabled){$('export-dialog').close();}
}
function showExport(exported){
 releaseExport?.();exportReturnFocus=document.activeElement;activeExport=exported;
 $('export-name').textContent=exported.name;$('export-json').value=exported.text;
 $('export-status').textContent='Your JSON is ready. Save the file or copy its contents.';
 $('export-download').textContent='Download JSON';
 releaseExport=attachJSONDownload(exported,$('export-download'));
 $('save-json').hidden=typeof window.showSaveFilePicker!=='function'||window.self!==window.top;
 $('export-dialog').showModal();
}
function download(name,data){try{showExport(prepareJSONExport(name,data));}catch(e){notice('Export failed: '+e.message);}}
$('export-close').onclick=closeExport;
$('export-dialog').addEventListener('close',()=>{releaseExport?.();releaseExport=null;activeExport=null;exportReturnFocus?.focus?.();});
$('export-dialog').addEventListener('cancel',e=>{if($('save-json').disabled)e.preventDefault();});
$('export-download').onclick=()=>{$('export-status').textContent='Download requested. If no file appears, use Copy JSON or select and copy the content below.';};
$('save-json').onclick=async()=>{
 if(!activeExport)return;
 const exported=activeExport,b=$('save-json');b.disabled=true;$('export-close').disabled=true;
 try{
  const result=await saveJSONFile(exported,window.showSaveFilePicker?.bind(window));
  $('export-status').textContent=result.status==='saved'?'File saved: '+exported.name:result.status==='cancelled'?'Save cancelled. You can try again or copy the JSON.':'Saving is unavailable here. Use Download JSON, or copy the content below and save it as '+exported.name+'.';
 }catch(e){$('export-status').textContent='Could not save the file: '+e.message+'. You can still download or copy the JSON below.';}
 finally{b.disabled=false;$('export-close').disabled=false;}
};
$('copy-export').onclick=async()=>{
 if(!activeExport)return;
 try{await navigator.clipboard.writeText(activeExport.text);$('export-status').textContent='JSON copied. Paste it into a text file and save it as '+activeExport.name+'.';}
 catch{$('export-json').focus();$('export-json').select();$('export-status').textContent='Automatic copy is unavailable. The JSON is selected; press Ctrl+C (or Command+C) and save it as '+activeExport.name+'.';}
};
window.addEventListener('pagehide',()=>{releaseExport?.();releaseExport=null;});
function saveInvoice(invoice){const same=invoices.find(i=>i.id===invoice.id);if(same&&canonical(same)!==canonical(invoice))throw new Error('A different request already uses this ID. Import refused.');if(!same){if(invoices.length>=200)throw new Error('Export your workspace before adding more than 200 requests.');invoices.unshift(invoice);persist();}render();}
function recordReceipt(invoice,result){
 assertReceiptAssignment(invoice,result,assignments);
 if(result.status==='paid'){assignments[invoice.chainId+':'+result.hash]=invoice.id;persist();}
 receipts[invoice.id]=result;
}
function render(){const mainnetPaid=invoices.filter(i=>i.chainId===5042&&receipts[i.id]?.status==='paid'),allPaid=invoices.filter(i=>receipts[i.id]?.status==='paid');$('stat-paid').textContent=allPaid.length;$('stat-open').textContent=invoices.filter(i=>receipts[i.id]?.status!=='paid'&&i.expiresAt>Date.now()).length;$('stat-total').replaceChildren(el('span',formatUnits(mainnetPaid.reduce((s,i)=>s+amountUnits(i.amount),0n))),el('span',' USDC','unit'));
 const list=$('requests');list.replaceChildren();if(!invoices.length){const empty=el('div',undefined,'empty');empty.append(el('div','↗','empty-symbol'),el('h3','A clean start.'),el('p','Create your first request. Your payment trail starts here.'),action('Create a request →',()=>show('create'),'button primary'));list.append(empty);}
 invoices.slice(0,12).forEach(i=>{const row=el('div',undefined,'row'),left=el('div'),right=el('div',undefined,'row-actions');const paid=receipts[i.id]?.status==='paid';left.append(el('strong',i.reference),el('p',i.id+' · '+NETWORKS[i.chainId].name),el('span',i.amount+' USDC'));right.append(el('span',paid?'Verified':recordedTransferHash(i,assignments)?'Recheck transfer':i.expiresAt<Date.now()?'Expired':'Not verified',paid?'pill success':'pill neutral'),action('Open',()=>openPayment(i)),action('Verify',()=>{show('verify');$('verify-request').value=i.id;$('transaction-hash').value=trackedHash(i)||'';$('receipt').hidden=true;}));row.append(left,right);list.append(row);});renderSelect();}
function renderSelect(){const select=$('verify-request'),prior=select.value;select.replaceChildren();if(!invoices.length){select.append(el('option','Create or import a payment request first'));select.disabled=true;}else{select.disabled=false;for(const i of invoices){const o=el('option',i.reference+' · '+i.amount+' USDC · '+NETWORKS[i.chainId].name);o.value=i.id;select.append(o);}if(invoices.some(i=>i.id===prior))select.value=prior;}}
function detail(container,entries){container.replaceChildren();for(const [key,value]of entries){container.append(el('dt',key),el('dd',value));}}
function openPayment(invoice){if(paymentBusy){notice('Finish the current wallet review before opening another request.');return;}current=validateInvoice(invoice);$('payment-summary').replaceChildren(el('span',NETWORKS[current.chainId].name,current.chainId===5042?'pill warning':'pill neutral'),el('h2',current.reference));const amount=el('p',current.amount,'payment-amount');amount.append(el('small',' USDC'));const d=el('dl');detail(d,[['Recipient',current.recipient],['Request',current.id],['Expires',new Date(current.expiresAt).toLocaleString()],...(current.expectedPayer?[['Expected payer',current.expectedPayer]]:[])]);$('payment-summary').append(amount,d);$('payment-progress').textContent=trackedHash(current)?'A transfer hash is recorded for this request. Recheck it before considering another payment. This button will not send a new transaction.':'';$('payment-progress').className='';$('pay-button').textContent=receipts[current.id]?.status==='paid'?'Transfer already verified':Boolean(trackedHash(current))?'Recheck transaction receipt →':'Review payment in wallet →';$('pay-button').disabled=receipts[current.id]?.status==='paid'||current.expiresAt<Date.now()&&!Boolean(trackedHash(current));$('test-funds').hidden=current.chainId!==5042002;$('manual-recipient').value=current.recipient;$('manual-amount').textContent=current.amount+' USDC on '+NETWORKS[current.chainId].name;renderPayers();show('pay');}
function walletSession(){
 const injected=window.ethereum?.providers?.find(p=>p.isMetaMask)||window.ethereum;
 if(!wallet||provider!==injected){wallet?.dispose();provider=injected;wallet=createWalletSession(provider,{onChange:a=>{account=a;$('connect').textContent=a?a.slice(0,6)+'…'+a.slice(-4):'Connect wallet';renderPayers();}});}
 return wallet;
}
function renderPayers(){
 const select=$('payer-account');select.replaceChildren();
 const allowed=wallet?.accounts||[];
 if(!allowed.length){select.append(el('option','Connect a payer account'));select.disabled=true;}
 else{for(const a of allowed){const option=el('option',a+(a===current?.recipient?' · Recipient — choose your other account':''));option.value=a;select.append(option);}select.value=account||allowed[0];select.disabled=paymentBusy;}
 $('payer-hint').textContent=account===current?.recipient?'You are connected as the recipient. Connect and select your other account to pay this request.':'The selected account pays the amount and network fee. Choosing an account does not send a payment.';
 $('payer-hint').className=account===current?.recipient?'helper payer-warning':'helper';
}
$('choose-payer').onclick=async()=>{
 if(paymentBusy)return;
 paymentBusy=true;$('choose-payer').disabled=true;$('pay-button').disabled=true;$('connect').disabled=true;$('payer-account').disabled=true;
 $('payment-progress').className='';$('payment-progress').textContent='Open MetaMask and connect the account you want to pay from.';
 try{await walletSession().choosePayer();$('payment-progress').textContent=account===current?.recipient?'The recipient is still selected. Select your other authorized account under Pay from, or connect it with Choose payer in MetaMask.':'Payer connected. Review the amount and recipient, then click Review payment in wallet.';$('notice').hidden=true;}
 catch(e){$('payment-progress').className='payment-error';$('payment-progress').textContent=walletErrorMessage(e);}
 finally{paymentBusy=false;$('choose-payer').disabled=false;$('connect').disabled=false;$('pay-button').disabled=receipts[current?.id]?.status==='paid'||current?.expiresAt<Date.now()&&!Boolean(trackedHash(current));renderPayers();}
};
$('payer-account').onchange=async()=>{
 if(paymentBusy)return;
 const selected=$('payer-account').value;paymentBusy=true;$('payer-account').disabled=true;$('pay-button').disabled=true;$('choose-payer').disabled=true;$('connect').disabled=true;
 try{await walletSession().selectAccount(selected);$('payment-progress').textContent=trackedHash(current)?'A transfer hash is recorded for this request. Recheck it before considering another payment. This button will not send a new transaction.':'';$('payment-progress').className='';$('notice').hidden=true;}
 catch(e){$('payment-progress').className='payment-error';$('payment-progress').textContent=walletErrorMessage(e);}
 finally{paymentBusy=false;$('choose-payer').disabled=false;$('connect').disabled=false;$('pay-button').disabled=receipts[current?.id]?.status==='paid'||current?.expiresAt<Date.now()&&!Boolean(trackedHash(current));renderPayers();}
};
async function connect(){const b=$('connect');b.disabled=true;try{account=await walletSession().connect();return account;}finally{b.disabled=paymentBusy;}}
function renderReceipt(invoice,result){currentReceipt={invoice,result};$('receipt').hidden=false;$('receipt-status').textContent=result.status==='paid'?'Verified on Arc':result.status;$('receipt-status').className='pill '+(result.status==='paid'?'success':result.status==='pending'?'warning':'failure');$('receipt-heading').textContent=result.status==='paid'?'Transfer verified.':result.status==='pending'?'Waiting for confirmation.':'Payment not verified.';$('receipt-reason').textContent=result.reason||'Check the transfer details before assigning this receipt to a request.';const entries=[['Network',NETWORKS[invoice.chainId].name],['Request',invoice.id],['Transaction',result.hash]];if(result.status==='paid')entries.push(['Amount',result.amount+' USDC'],['From',result.from],['To',result.to],['Fee',result.fee+' USDC'],['Block',result.blockNumber],['Paid at',new Date(result.timestamp).toLocaleString()],['Request association',result.binding==='reference'?'Legacy on-chain reference':'Selected locally; confirm which request this payment settles'],['Request digest (local)',result.fingerprint]);detail($('receipt-data'),entries);$('explorer-link').href=NETWORKS[invoice.chainId].explorer+'/tx/'+hashValue(result.hash);$('export-receipt').hidden=result.status!=='paid';}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
$('mainnet-demo').onclick=async()=>{const b=$('mainnet-demo');b.disabled=true;try{const i=validateInvoice(MAINNET_DEMO.invoice);saveInvoice(i);show('verify');$('verify-request').value=i.id;$('transaction-hash').value=MAINNET_DEMO.hash;notice('Checking the builder’s mainnet demonstration against Arc RPC…');const result=await verifyReceipt(i,MAINNET_DEMO.hash);recordReceipt(i,result);renderReceipt(i,result);render();notice(result.status==='paid'?'Mainnet demonstration transfer verified. See the sender, recipient, amount and reference limitations below.':result.reason,result.status==='paid');}catch(e){notice('Could not verify the mainnet demo: '+e.message);}finally{b.disabled=false;}};
$('new-request').onclick=()=>show('create');$('go-verify').onclick=()=>show('verify');$('connect').onclick=()=>connect().catch(e=>notice(walletErrorMessage(e)));$('use-wallet').onclick=()=>Promise.resolve(account||connect()).then(a=>$('recipient').value=a).catch(e=>notice(e.message));
$('request-form').addEventListener('submit',async event=>{event.preventDefault();if(paymentBusy){notice('Finish the current wallet review before creating another payment request.');return;}try{const i=createInvoice({recipient:$('recipient').value.trim(),amount:$('amount').value.trim(),reference:$('reference').value,chainId:$('network').value,expectedPayer:$('expected-payer').value.trim()||undefined});saveInvoice(i);current=i;$('created').hidden=false;$('created-title').textContent=i.reference+' · '+i.amount+' USDC';$('share-link').value=paymentLink(i,location.href);notice('Request created. No funds have moved.',true);}catch(e){notice(e.message);}});
$('copy-link').onclick=()=>navigator.clipboard.writeText($('share-link').value).then(()=>notice('Payment link copied.',true)).catch(()=>notice('Copy is unavailable. Select the payment link and copy it manually.'));
$('open-payment').onclick=()=>{if(current)openPayment(current);};$('export-request').onclick=()=>{if(current)download(current.id+'.json',current);};
$('verify-form').addEventListener('submit',async event=>{event.preventDefault();const b=event.submitter;b.disabled=true;try{const i=invoices.find(x=>x.id===$('verify-request').value);if(!i)throw new Error('Select a valid payment request.');const result=await verifyReceipt(i,$('transaction-hash').value.trim());recordReceipt(i,result);renderReceipt(i,result);render();}catch(e){$('receipt').hidden=true;notice(e.message);}finally{b.disabled=false;}});
$('export-receipt').onclick=()=>{try{showExport(verifiedReceiptExport(currentReceipt));}catch(e){notice('Receipt export failed: '+e.message);}};
$('save-payment').onclick=()=>{try{saveInvoice(current);notice('Request saved in this browser.',true);}catch(e){notice(e.message);}};
$('pay-button').onclick=async()=>{
 if(paymentBusy)return;
 const b=$('pay-button'),i=current;paymentBusy=true;b.disabled=true;$('connect').disabled=true;$('choose-payer').disabled=true;$('payer-account').disabled=true;
 $('payment-progress').className='';
 let hash=trackedHash(i);
 try{
  if(!i)throw new Error('No request selected.');
  if(!hash){
   const sent=await walletSession().reviewPayment(i,message=>{$('payment-progress').textContent=message;});
   hash=sent.hash;broadcasts.set(i.id,hash);
  }
  $('transaction-hash').value=hash;
  $('payment-progress').textContent='Checking transfer: '+hash+'. Checking inclusion…';
  saveInvoice(i);
  for(let attempt=0;attempt<5;attempt++){
   const result=await verifyReceipt(i,hash);
   if(result.status!=='pending'){
    recordReceipt(i,result);render();show('verify');$('verify-request').value=i.id;renderReceipt(i,result);return;
   }
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
  $('payment-progress').textContent='Still awaiting confirmation. Hash: '+hash+'. Click Recheck transaction receipt to check this transaction without sending another payment.';
 }catch(e){
  const message=walletErrorMessage(e);
  notice(message);
  $('payment-progress').className='payment-error';
  $('payment-progress').textContent=hash?'Transaction hash: '+hash+'. '+message+' Recheck this receipt before sending another payment.':message+(e.phase==='send'?' Check MetaMask Activity before retrying; no transaction hash was returned.':' No transaction was sent.');
 }finally{
  paymentBusy=false;b.disabled=receipts[current?.id]?.status==='paid'||!!current&&current.expiresAt<Date.now()&&!Boolean(trackedHash(current));$('connect').disabled=false;$('choose-payer').disabled=false;renderPayers();
  b.textContent=i&&receipts[i.id]?.status==='paid'?'Transfer already verified':i&&Boolean(trackedHash(i))?'Recheck transaction receipt →':'Review payment in wallet →';
 }
};
$('export-workspace').onclick=()=>download('arc-ledger-workspace.json',{version:1,invoices});$('import-workspace').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{try{const file=$('import-file').files[0];if(!file)return;if(file.size>300000)throw new Error('Import file exceeds 300 KB.');const input=JSON.parse(await file.text());const items=Array.isArray(input.invoices)?input.invoices:[input];if(items.length>200)throw new Error('Import at most 200 requests.');const checked=items.map(validateInvoice),merged=[...invoices];for(const i of checked){const old=merged.find(x=>x.id===i.id);if(old&&canonical(old)!==canonical(i))throw new Error('Import contains conflicting request IDs. Nothing was imported.');if(!old)merged.push(i);}if(merged.length>200)throw new Error('Workspace would exceed 200 requests.');invoices=merged;persist();render();notice('Requests imported. Payment claims must be verified against the chain.',true);}catch(e){notice(e.message);}finally{$('import-file').value='';}};
render();if(location.hash.startsWith('#pay=')){try{openPayment(decodeInvoice(location.hash.slice(5)));}catch(e){notice(e.message);}}
