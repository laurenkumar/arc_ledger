# Arc Ledger

Live app: https://arcledger-roan.vercel.app/

Native-USDC payment requests and independently checked transfer receipts on Arc.

Create a request, share its link, let the payer confirm a plain USDC transfer in their own wallet, and verify the transfer using its transaction hash. A recipient can also check a payment made outside the app without connecting either wallet.

## Mainnet demonstration

- Arc Mainnet chain ID: **5042**.
- Builder-provided demonstration: **1 USDC** sent between distinct addresses on October 14, 2026, 11:49:16 UTC.
- [Transaction](https://explorer.arc.io/tx/0x84358a18cb166f494401757748a5e4be21f24aead683549306f89b2f20f9f972).
- The app's **Verify mainnet demo** button re-reads the transaction, receipt and block from the public Arc RPC; it does not trust a cached paid flag or connect a wallet.

The supplied receipt reports block 25917473 and a 0.00042-USDC fee. This is a builder demonstration, not evidence of a paying customer. Its request digest was checked locally; see [evidence notes](docs/MAINNET_DEMO.md).

## What the app does

- Arc Mainnet and Testnet, with an explicit network choice before creating a request.
- BigInt-native 18-decimal USDC amounts, accepting up to six input decimals.
- Shareable payment links; optional expected-payer address.
- Non-custodial payment through an injected EVM wallet. The payer confirms the transaction. No keys, custody or token approvals.
- Network, account, balance and fee checks before signing; 0.05-USDC maximum estimated fee budget.
- Plain transfers without calldata, compatible with the internal-account restriction encountered in MetaMask.
- Independent receipt verification: network, success, inclusion, amount, recipient, sender, timestamp, and expected payer when specified.
- Request/receipt JSON export with save/download/copy options, plus workspace import/export.
- Browser-local transaction assignment: one hash cannot settle two requests in the same workspace.

## What a receipt proves

A standard transfer proves the on-chain transfer facts. It does **not** cryptographically bind the payment to a particular invoice or reference; that association is a local bookkeeping choice. Legacy referenced transfers remain verifiable. Exported JSON is unsigned and should be rechecked against the chain before relying on it.

Assignments are browser-local, not a global registry. Live receipt results reset after reload; recorded hashes must be rechecked and never count as cached proof of payment. A recorded transfer changes the payment button into a read-only receipt check, avoiding a new transaction after reload. The sender's real-world identity is not authenticated. There is no backend, exchange-deposit attribution, ERP integration, contract-account recipient support or smart-contract deployment in this version. This is a payment-request prototype, not a tax-invoicing system or an audited financial product.

## Run and validate

Node.js 22 or newer; no npm dependencies.

```sh
npm run check
npm test
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. Production must use HTTPS for wallet and clipboard APIs. Requests are stored under the origin where they were created; a new Vercel origin has its own browser workspace. Import the workspace JSON or use the demonstration button after moving hosts.

65 automated tests cover amounts, receipts, wallet events, account selection, pending approvals, duplicate assignments and file export. They use simulated wallet/RPC/file APIs. The public Vercel app was tested in a browser: mainnet RPC revalidation, receipt download, request creation and shared-link rendering. See [verification notes](docs/VERIFICATION.md).

## Deploy on Vercel

Import **laurenkumar/arc_ledger** into Vercel. The included `vercel.json` selects Other, skips installation, validates/tests the source and serves `dist/`. No environment variables or RPC API keys are required. The production URL must be publicly accessible, with Vercel Authentication/password protection disabled for visitors.

After deployment: open the URL without signing in, click Verify mainnet demo, verify a receipt, export JSON, and open a shared payment link. Do not submit the private development URL as the public demo.

## Grant preparation

[Requirements review](docs/REQUIREMENTS.md) · [Application draft](docs/ARC_SUBMISSION.md) · [Arc network documentation](https://docs.arc.io/arc/references/connect-to-arc).

The app was developed with AI assistance and iterated using builder feedback. Automated tests and observed behavior are documented; they are not an independent security audit. Arc's linked participation terms support responsible AI use. Hosting on Vercel is for public access and independent deployment, not an authorship claim.

MIT license. Public builder profile: https://github.com/laurenkumar.
