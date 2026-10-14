# Mainnet demonstration and live RPC revalidation

The builder supplied a receipt on October 14, 2026. It reports:

| Field | Value |
|---|---|
| Chain | Arc Mainnet, 5042 |
| Transaction | 0x84358a18cb166f494401757748a5e4be21f24aead683549306f89b2f20f9f972 |
| Amount | 1 native USDC |
| Fee | 0.00042 native USDC |
| Block | 25917473 |
| Timestamp | 2026-10-14 11:49:16 UTC |
| Request | AL-032E9BC2576A |
| Request digest | 33d2263f9d4e148f4e83694d4d4511ba5d8774ef366224c906fbc4af0e1fbd07 |

[View transaction](https://explorer.arc.io/tx/0x84358a18cb166f494401757748a5e4be21f24aead683549306f89b2f20f9f972).

Local checks confirmed the request schema, hash format, timestamp window and exact SHA-256 request digest. On October 14, 2026, the public app at https://arcledger-roan.vercel.app/ independently re-read the transaction, receipt and block through Arc RPC in a browser. The exported JSON reports verifiedAt 1791983173772 (13:06:13.772 UTC), matching the supplied amount, sender, recipient, fee and block. The JSON download completed and was parsed successfully. This verifies transfer facts, not customer identity or an independent security audit.

The app includes the request and hash in dist/demo.mjs, without a cached verification result. Click Verify mainnet demo on the public deployment to read the actual Arc RPC again. It checks chain, transaction hash, receipt status, matching inclusion block, recipient, value and timestamp. The result should show the sender and recipient and a 1-USDC transfer. An unavailable RPC must show an error, never a fabricated verified result.

This was a demonstration between different addresses. The supplied receipt uses binding `transfer`: the request association is local, not an on-chain request reference. No external customer, adoption, custody or deployed contract is claimed.

## Additional mainnet payment matching the public-app request

The builder supplied a second payment link and transaction on October 14, 2026. The public Vercel app independently rechecked this transfer through Arc RPC:

- Request: AL-E3A4D9E9980A, created for 0.5 USDC on Arc Mainnet (5042).
- Transaction: https://explorer.arc.io/tx/0x7c6d473770bc1e180926f4b6fce28bed1c0ce36c3966b515a3fb0462ecc20f98
- Sender: 0x175813a2b27d575e41b905617f4fb8ade3c67d5e.
- Recipient: 0xcc91e29cd39e620cf4e84c1d036ce0a97c584e34.
- Amount: 0.5 USDC; fee: 0.00042 USDC.
- Block: 25929241; paid at 2026-10-14 13:28:38 UTC (15:28:38 Europe/Paris).
- Request digest: bbeb1fe185b8c2c403e655370962ee0a29c66820c7da3214308ae4d3daaf4029.

The app rendered Transfer verified for this request. Amount, recipient, sender, network, inclusion and time window passed. This is another builder demonstration; its standard-transfer association is local bookkeeping and does not prove an on-chain invoice reference or a commercial customer. The agent rechecked the transfer without connecting a wallet or sending funds.
