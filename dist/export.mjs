import {validateInvoice,hashValue} from './core.mjs?v=1.4.1';

export function prepareJSONExport(name,data) {
  if(typeof name!=='string'||!name.endsWith('.json'))throw new Error('Export needs a JSON filename.');
  const text=JSON.stringify(data,null,2);
  if(typeof text!=='string')throw new Error('There is no JSON content to export.');
  return {name:name.replace(/[\\/\x00-\x1f]/g,'_'),text:text+'\n',type:'application/json'};
}

export function verifiedReceiptExport(receipt) {
  if(!receipt||receipt.result?.status!=='paid')throw new Error('Verify a successful payment before exporting its receipt.');
  const invoice=validateInvoice(receipt.invoice);
  hashValue(receipt.result.hash);
  if(receipt.result.chainId!==invoice.chainId)throw new Error('Receipt and request networks do not match.');
  return prepareJSONExport(invoice.id+'-receipt.json',{
    version:1,invoice,result:receipt.result,
    verification:'The transfer was checked via the public Arc RPC at verifiedAt. For standard transfers, the request association is a local bookkeeping choice, not an on-chain proof. Re-run verification before relying on this unsigned JSON.'
  });
}

export async function saveJSONFile(exported,picker) {
  if(typeof picker!=='function')return {status:'unavailable'};
  try {
    const handle=await picker({suggestedName:exported.name,types:[{description:'JSON file',accept:{'application/json':['.json']}}]});
    const writable=await handle.createWritable();
    try{await writable.write(new Blob([exported.text],{type:exported.type}));await writable.close();}
    catch(error){try{await writable.abort?.();}catch{}throw error;}
    return {status:'saved'};
  }catch(error){
    if(error?.name==='AbortError')return {status:'cancelled'};
    if(['SecurityError','NotAllowedError'].includes(error?.name))return {status:'blocked'};
    throw error;
  }
}

// Keep this link attached and its URL alive until the export is closed/replaced.
// A short revoke timer or a detached synthetic anchor can lose the download.
export function attachJSONDownload(exported,anchor,urlAPI=URL) {
  const url=urlAPI.createObjectURL(new Blob([exported.text],{type:exported.type}));
  anchor.href=url;anchor.download=exported.name;
  return ()=>{anchor.removeAttribute('href');anchor.removeAttribute('download');urlAPI.revokeObjectURL(url);};
}
