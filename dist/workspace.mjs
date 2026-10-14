// A recorded assignment is a lookup hint, never proof that a transfer succeeded.
export function recordedTransferHash(invoice, assignments) {
  if (!invoice) return null;
  const prefix = String(invoice.chainId) + ':';
  for (const [key, requestId] of Object.entries(assignments || {})) {
    if (requestId !== invoice.id || !key.startsWith(prefix)) continue;
    const hash = key.slice(prefix.length);
    if (/^0x[a-f0-9]{64}$/.test(hash)) return hash;
  }
  return null;
}
