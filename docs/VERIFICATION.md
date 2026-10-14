# Public browser verification — October 14, 2026

Deployment: https://arcledger-roan.vercel.app/

## Observed in the public browser

- Homepage loaded directly without Vercel authentication, showing v1.4.1.
- Verify mainnet demo queried Arc RPC and returned a paid transfer on chain 5042: 1 USDC, 0.00042-USDC fee, block 25917473, supplied sender/recipient and transaction hash.
- Export verified receipt opened the JSON dialog. Download JSON produced a real 1205-byte file, parsed successfully. Its fresh verifiedAt was 1791983173772.
- Copy JSON showed a success message; clipboard bytes were not independently confirmed through the browser automation clipboard interface.
- A testnet request for 1.23 USDC with an expected payer generated a payment link. The link opened in another tab with the same network, recipient, amount, reference and expected payer. No transaction was sent.
- Both requests remained after reload. Live receipt results correctly reset, but the old wording incorrectly suggested an already checked request was awaiting payment.
- Browser logs contained extension metadata errors; no application error was observed during the successful flows.

## Reload correction in v1.4.2

A saved assignment is only a hash to recheck, never a paid claim. The request badge now says Recheck transfer, and opening that request offers a read-only receipt recheck instead of a new wallet payment. Generic requests are labelled Not verified; dashboard totals explicitly refer to this session. Two regression tests cover restored hints and isolation by request/network.

Production validation of the correction is pending the automatic GitHub deployment. A new MetaMask signature and transfer on this Vercel origin has not been tested by the agent and remains participant-controlled.

## Submission status

Public deployment and public source are available. The application is prepared, not submitted. The submission portal's fields and participant declarations still require final review.
