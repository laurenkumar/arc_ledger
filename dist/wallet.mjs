import {NETWORKS,address,hexQuantity,hashValue,preparePayment,validateInvoice,formatUnits} from './core.mjs?v=1.4.1';

export function walletErrorCode(error) {
  return error?.code ?? error?.data?.originalError?.code ?? error?.cause?.code;
}

export function walletErrorMessage(error) {
  const code=walletErrorCode(error);
  if(code===4001)return 'You declined the wallet request. Click Review payment when you are ready.';
  if(code===-32002)return 'A request is already waiting in MetaMask. Open the extension and approve or reject that request before trying again.';
  return error?.message||'The wallet could not complete this request.';
}

export function createWalletSession(provider,{onChange=()=>{},readTimeout=15000}={}) {
  if(!provider?.request)throw new Error('Open this page in a browser with an EVM wallet extension, or in your wallet’s browser.');
  let account=null,accounts=[],chosen=null,revision=0,connecting=null,busy=false;
  const publish=()=>onChange(account,[...accounts]);
  function remember(values) {
    accounts=Array.isArray(values)?values.map(address):[];
    if(chosen&&!accounts.includes(chosen))chosen=null;
    account=chosen||accounts[0]||null;
  }
  function updateAccounts(accounts) {
    revision++;
    try {remember(accounts);}catch{account=null;}
    publish();
  }
  const changeChain=()=>{revision++;};
  const disconnect=()=>{revision++;account=null;accounts=[];chosen=null;publish();};
  provider.on?.('accountsChanged',updateAccounts);
  provider.on?.('chainChanged',changeChain);
  provider.on?.('disconnect',disconnect);

  // Only read operations time out. Approvals/sending stay pending until the wallet
  // answers: timing out a signature and allowing retry could cause a duplicate payment.
  async function read(method,params=[]) {
    let timer;
    try {return await Promise.race([
      provider.request({method,params}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The wallet did not answer '+method+'. Check its selected network and connection, then retry.')),readTimeout);})
    ]);}finally{clearTimeout(timer);}
  }
  const interactive=(method,params=[])=>provider.request({method,params});
  async function connect() {
    if(connecting)return connecting;
    connecting=(async()=>{
      let accounts=await read('eth_accounts');
      if(!accounts?.length)await interactive('eth_requestAccounts');
      // accountsChanged is expected while granting access. Re-read the selected
      // account instead of treating that event as a failed first connection.
      accounts=await read('eth_accounts');
      if(!accounts?.length)throw new Error('No wallet account is connected. Unlock MetaMask and connect a payer account.');
      remember(accounts);publish();return account;
    })();
    try{return await connecting;}finally{connecting=null;}
  }
  async function choosePayer() {
    if(busy)throw new Error('Finish the current wallet review before choosing a payer.');
    busy=true;
    try{
      await interactive('wallet_requestPermissions',[{eth_accounts:{}}]);
      chosen=null;
      return await connect();
    }finally{busy=false;}
  }
  async function selectAccount(value) {
    if(busy)throw new Error('Finish the current wallet review before choosing a payer.');
    const selected=address(value),allowed=await read('eth_accounts');
    if(!allowed?.some(a=>address(a)===selected))throw new Error('This payer is not connected to the site. Click Choose payer in MetaMask to authorize it.');
    chosen=selected;remember(allowed);revision++;publish();return account;
  }
  async function ensureNetwork(chainId) {
    const net=NETWORKS[chainId];if(!net)throw new Error('Unsupported network.');
    const target='0x'+chainId.toString(16);
    if(hexQuantity(await read('eth_chainId'))===BigInt(chainId))return;
    try{await interactive('wallet_switchEthereumChain',[{chainId:target}]);}
    catch(error){
      if(walletErrorCode(error)!==4902)throw error;
      await interactive('wallet_addEthereumChain',[{chainId:target,chainName:net.name,nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:[net.rpc],blockExplorerUrls:[net.explorer]}]);
      // Some wallets add and switch together. Do not create another approval
      // request if the selected chain is already correct.
      if(hexQuantity(await read('eth_chainId'))!==BigInt(chainId))await interactive('wallet_switchEthereumChain',[{chainId:target}]);
    }
    for(let attempt=0;attempt<5;attempt++){
      if(hexQuantity(await read('eth_chainId'))===BigInt(chainId))return;
      if(attempt<4)await new Promise(resolve=>setTimeout(resolve,150));
    }
    throw new Error('The wallet has not switched to '+net.name+'. Select that network in MetaMask, then retry.');
  }
  async function reviewPayment(invoice,onProgress=()=>{}) {
    if(busy)throw new Error('A payment request is already being reviewed in your wallet.');
    busy=true;let phase='connect';
    try{
      const i=validateInvoice(invoice);
      onProgress('Connecting to your wallet…');
      const from=await connect();
      if(from===i.recipient)throw new Error('Pay from and Recipient are the same address. Click Choose payer in MetaMask and connect your other account, then select it under Pay from.');
      phase='network';onProgress('Checking '+NETWORKS[i.chainId].name+'… Approve any network request in MetaMask.');
      await ensureNetwork(i.chainId);
      const selected=await read('eth_accounts');
      if(!selected?.some(a=>address(a)===from))throw new Error('The payer is no longer authorized. Choose a payer account, then review the payment again.');
      const initialRevision=revision;
      phase='prepare';onProgress('Checking the payer’s USDC balance and estimating the fee…');
      const request=async(method,params)=>{
        const value=await read(method,params);
        if(method==='eth_getBalance')onProgress('Payer balance: '+formatUnits(hexQuantity(value),18)+' USDC on '+NETWORKS[i.chainId].name+'. Checking the payment and fee…');
        return value;
      };
      const prepared=await preparePayment(i,from,request);
      const active=await read('eth_accounts'),chain=await read('eth_chainId');
      if(revision!==initialRevision||!active?.some(a=>address(a)===from)||hexQuantity(chain)!==BigInt(i.chainId))throw new Error('Wallet account or network changed during preparation. Review the payment again.');
      phase='send';onProgress('Check MetaMask: '+i.amount+' USDC to '+i.recipient+'. Maximum estimated fee '+prepared.maximumFee+' USDC. Approve or reject the transaction in your wallet.');
      const hash=hashValue(await interactive('eth_sendTransaction',[prepared.transaction]));
      return {hash,prepared,from};
    }catch(error){
      const wrapped=new Error(walletErrorMessage(error));wrapped.code=walletErrorCode(error);wrapped.phase=phase;throw wrapped;
    }finally{busy=false;}
  }
  return {connect,choosePayer,selectAccount,reviewPayment,get account(){return account;},get accounts(){return [...accounts];},get busy(){return busy;},
    dispose(){provider.removeListener?.('accountsChanged',updateAccounts);provider.removeListener?.('chainChanged',changeChain);provider.removeListener?.('disconnect',disconnect);}};
}
