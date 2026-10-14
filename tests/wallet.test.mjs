import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvoice,quantity} from '../dist/core.mjs';
import {createWalletSession,walletErrorMessage} from '../dist/wallet.mjs';

const payer='0x'+'2'.repeat(40),recipient='0x'+'1'.repeat(40),hash='0x'+'a'.repeat(64);
const chain=5042002,hexChain=quantity(chain);
const invoice=()=>createInvoice({recipient,amount:'1',reference:'Wallet regression',chainId:chain});

class Wallet {
  accounts=[];chain='0x1';added=false;balance=quantity(10n**19n);calls=[];listeners=new Map();override=null;
  on(event,fn){this.listeners.set(event,[...(this.listeners.get(event)||[]),fn]);}
  removeListener(event,fn){this.listeners.set(event,(this.listeners.get(event)||[]).filter(x=>x!==fn));}
  emit(event,value){for(const fn of this.listeners.get(event)||[])fn(value);}
  async request({method,params=[]}){
    this.calls.push({method,params});
    if(this.override){const result=this.override(method,params);if(result!==undefined)return result;}
    switch(method){
      case 'eth_accounts':return this.accounts;
      case 'eth_requestAccounts':this.accounts=[payer];this.emit('accountsChanged',this.accounts);return this.accounts;
      case 'wallet_requestPermissions':this.accounts=[payer];this.emit('accountsChanged',this.accounts);return [{parentCapability:'eth_accounts'}];
      case 'eth_chainId':return this.chain;
      case 'wallet_switchEthereumChain':
        if(!this.added)throw Object.assign(new Error('Unknown chain'),{code:4902});
        this.chain=params[0].chainId;this.emit('chainChanged',this.chain);return null;
      case 'wallet_addEthereumChain':this.added=true;this.chain=params[0].chainId;this.emit('chainChanged',this.chain);return null;
      case 'eth_getCode':return '0x';
      case 'eth_getBalance':return this.balance;
      case 'eth_estimateGas':return '0x6000';
      case 'eth_gasPrice':return '0x1';
      case 'eth_sendTransaction':
        if(params[0].data&&params[0].data!=='0x')throw new Error('External transactions to internal accounts cannot include data');
        return hash;
      default:throw new Error('Unexpected method '+method);
    }
  }
}
const count=(w,m)=>w.calls.filter(c=>c.method===m).length;

test('first connection tolerates accountsChanged while MetaMask grants access',async()=>{
  const w=new Wallet(),changes=[],s=createWalletSession(w,{onChange:a=>changes.push(a)});
  assert.equal(await s.connect(),payer);assert.equal(s.account,payer);
  assert.equal(count(w,'eth_requestAccounts'),1);assert.ok(changes.includes(payer));
});
test('first payment continues after adding and switching to Arc Testnet',async()=>{
  const w=new Wallet(),s=createWalletSession(w),progress=[];
  assert.equal((await s.reviewPayment(invoice(),p=>progress.push(p))).hash,hash);
  assert.equal(count(w,'wallet_addEthereumChain'),1);
  assert.equal(count(w,'wallet_switchEthereumChain'),1); // unknown-chain attempt only
  assert.equal(count(w,'eth_sendTransaction'),1);
  const tx=w.calls.find(c=>c.method==='eth_sendTransaction').params[0];
  assert.equal(tx.chainId,hexChain);assert.equal(tx.from,payer);assert.equal(tx.to,recipient);
  assert.equal(Object.hasOwn(tx,'data'),false);
  assert.ok(progress.some(p=>p.includes('Payer balance: 10 USDC')));
});
test('an already connected wallet on Arc proceeds without another network prompt',async()=>{
  const w=new Wallet();w.accounts=[payer];w.chain=hexChain;w.added=true;
  const s=createWalletSession(w);await s.reviewPayment(invoice());
  assert.equal(count(w,'eth_requestAccounts'),0);assert.equal(count(w,'wallet_switchEthereumChain'),0);
  assert.equal(count(w,'eth_sendTransaction'),1);
});
test('add-network that does not switch is followed by an explicit switch',async()=>{
  const w=new Wallet();w.override=m=>{if(m==='wallet_addEthereumChain'){w.added=true;return Promise.resolve(null);}};
  const s=createWalletSession(w);await s.reviewPayment(invoice());
  assert.equal(count(w,'wallet_switchEthereumChain'),2);assert.equal(count(w,'eth_sendTransaction'),1);
});
test('zero balance gives an actionable faucet message before gas estimation and signing',async()=>{
  const w=new Wallet();w.balance='0x0';const s=createWalletSession(w);
  await assert.rejects(s.reviewPayment(invoice()),e=>e.phase==='prepare'&&/balance 0 USDC.*Circle faucet/.test(e.message));
  assert.equal(count(w,'eth_estimateGas'),0);assert.equal(count(w,'eth_sendTransaction'),0);assert.equal(s.busy,false);
});
test('recipient account gets a specific payer-account instruction without a transaction',async()=>{
  const w=new Wallet();w.accounts=[recipient];const s=createWalletSession(w);
  await assert.rejects(s.reviewPayment(invoice()),/Choose payer in MetaMask/);
  assert.equal(count(w,'eth_sendTransaction'),0);
});
test('a spontaneous account change during estimation cancels signing',async()=>{
  const w=new Wallet();w.override=m=>{if(m==='eth_estimateGas'){w.accounts=[recipient];w.emit('accountsChanged',w.accounts);return Promise.resolve('0x6000');}};
  const s=createWalletSession(w);await assert.rejects(s.reviewPayment(invoice()),/changed during preparation/);
  assert.equal(count(w,'eth_sendTransaction'),0);
});
test('a spontaneous network change during estimation cancels signing',async()=>{
  const w=new Wallet();w.override=m=>{if(m==='eth_estimateGas'){w.chain='0x1';w.emit('chainChanged',w.chain);return Promise.resolve('0x6000');}};
  const s=createWalletSession(w);await assert.rejects(s.reviewPayment(invoice()),/changed during preparation/);
  assert.equal(count(w,'eth_sendTransaction'),0);
});
test('wallet reads time out with a visible method-specific diagnostic and release the payment',async()=>{
  const w=new Wallet();w.override=m=>m==='eth_accounts'?new Promise(()=>{}):undefined;
  const s=createWalletSession(w,{readTimeout:10});
  await assert.rejects(s.reviewPayment(invoice()),/did not answer eth_accounts/);assert.equal(s.busy,false);
});
test('pending MetaMask request is explained; a rejected attempt can be retried',async()=>{
  const w=new Wallet();w.override=m=>{if(m==='eth_requestAccounts')return Promise.reject(Object.assign(new Error('pending'),{code:-32002}));};
  const s=createWalletSession(w);
  await assert.rejects(s.reviewPayment(invoice()),/already waiting in MetaMask/);assert.equal(s.busy,false);
  w.override=null;await s.reviewPayment(invoice());assert.equal(count(w,'eth_sendTransaction'),1);
});
test('no timeout or duplicate submission while the transaction approval is pending',async()=>{
  const w=new Wallet();let resolveSend,entered;
  const enteredSend=new Promise(resolve=>{entered=resolve;});
  w.override=m=>{if(m==='eth_sendTransaction'){entered();return new Promise(resolve=>{resolveSend=resolve;});}};
  const s=createWalletSession(w,{readTimeout:10}),first=s.reviewPayment(invoice());
  await enteredSend;await new Promise(resolve=>setTimeout(resolve,25));assert.equal(s.busy,true);
  await assert.rejects(s.reviewPayment(invoice()),/already being reviewed/);
  assert.equal(count(w,'eth_sendTransaction'),1);resolveSend(hash);assert.equal((await first).hash,hash);assert.equal(s.busy,false);
});
test('request rejection displays a useful message without automatic retry',async()=>{
  const w=new Wallet();w.override=m=>m==='eth_sendTransaction'?Promise.reject(Object.assign(new Error('rejected'),{code:4001})):undefined;
  const s=createWalletSession(w);await assert.rejects(s.reviewPayment(invoice()),/declined the wallet request/);
  assert.equal(count(w,'eth_sendTransaction'),1);assert.equal(s.busy,false);
  assert.match(walletErrorMessage({code:-32002}),/already waiting/);
});
test('recipient can reopen MetaMask account selection, then pay from the other account',async()=>{
  const w=new Wallet();w.accounts=[recipient];const s=createWalletSession(w);
  await s.connect();assert.equal(s.account,recipient);
  await assert.rejects(s.reviewPayment(invoice()),/same address/);
  assert.equal(await s.choosePayer(),payer);
  assert.deepEqual(w.calls.find(c=>c.method==='wallet_requestPermissions').params,[{eth_accounts:{}}]);
  assert.equal((await s.reviewPayment(invoice())).from,payer);
  assert.equal(count(w,'eth_sendTransaction'),1);
});
test('explicitly selected second authorized account is preserved while connecting and sending',async()=>{
  const w=new Wallet();w.accounts=[recipient,payer];const s=createWalletSession(w);
  await s.connect();assert.deepEqual(s.accounts,[recipient,payer]);
  await s.selectAccount(payer);assert.equal(await s.connect(),payer);
  const sent=await s.reviewPayment(invoice());assert.equal(sent.from,payer);
  assert.equal(w.calls.find(c=>c.method==='eth_sendTransaction').params[0].from,payer);
});
test('the site cannot choose an account which MetaMask has not authorized',async()=>{
  const w=new Wallet();w.accounts=[recipient];const s=createWalletSession(w);await s.connect();
  await assert.rejects(s.selectAccount(payer),/not connected to the site/);
  assert.equal(s.account,recipient);assert.equal(count(w,'eth_sendTransaction'),0);
});
test('declining account selection releases the control without sending a payment',async()=>{
  const w=new Wallet();w.accounts=[recipient];w.override=m=>m==='wallet_requestPermissions'?Promise.reject(Object.assign(new Error('declined'),{code:4001})):undefined;
  const s=createWalletSession(w);await s.connect();await assert.rejects(s.choosePayer());
  assert.equal(s.busy,false);assert.equal(s.account,recipient);assert.equal(count(w,'eth_sendTransaction'),0);
});
