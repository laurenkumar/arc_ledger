# Mainnet evidence supplied by the builder

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

Local checks confirmed the request schema, hash format, timestamp window and exact SHA-256 request digest. The development environment could not independently reload the explorer or RPC, so the table above is builder-supplied evidence, not a claimed independent revalidation.

The app includes the request and hash in dist/demo.mjs, without a cached verification result. Click Verify mainnet demo on the public deployment to read the actual Arc RPC again. It checks chain, transaction hash, receipt status, matching inclusion block, recipient, value and timestamp. The result should show the sender and recipient and a 1-USDC transfer. An unavailable RPC must show an error, never a fabricated verified result.

This was a demonstration between different addresses. The supplied receipt uses binding `transfer`: the request association is local, not an on-chain request reference. No external customer, adoption, custody or deployed contract is claimed.
