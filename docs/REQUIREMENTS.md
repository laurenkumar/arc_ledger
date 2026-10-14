# Arc Microgrants requirements review

Checked October 14, 2026 against the [organizer's announcement](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq) and its linked [participation terms](https://community.arc.io/public/resources/architects-terms-and-conditions).

| Published requirement | Arc Ledger status |
|---|---|
| Working Arc mainnet component | Wallet transfers and read-only verification implemented; builder supplied a mainnet payment receipt |
| Live deployment accessible to reviewers | Vercel-ready source; public deployment pending because the Vercel connection returned HTTP 403 on project creation |
| Public repository | Source and documentation published in the dedicated public repository |
| Short description and Arc relevance | Application draft describes native USDC payments, USDC fees and transfer verification |
| Public builder profile | https://github.com/laurenkumar |
| Right to submit the work | New original application with MIT license; participant remains responsible for declarations |
| No previous Circle/Arc funding; one submission per project | No prior funding or submission is claimed for this new project; participant must confirm the declarations |
| Wallet able to receive Arc USDC | Supplied receipt identifies a successful recipient; payout account and verification are participant-controlled |

The published announcement accepts small working prototypes. It does not specify a mandatory backend, smart contract, commercial customer base, video, pitch deck or feature count. The quality criteria concern Arc relevance, technical credibility and the quality/promise of the project. Meeting the public requirements does not guarantee selection.

The linked terms explicitly support responsible AI-assisted content and code, while leaving responsibility with the participant. Any additional portal-specific instructions must still be checked at submission: the DoraHacks detail page returned HTTP 405 in this research environment. Do not claim those unseen fields were verified.

Current technical validation: 63 unit tests plus static element/import checks. The real payment evidence is documented separately from simulated tests. Before submitting, test the public Vercel URL without authentication and recheck the mainnet demo via RPC.

Deadline in the organizer's announcement: October 14, 2026 23:59 ET, October 15 05:59 Europe/Paris. Recheck the submission portal's displayed deadline when filing.
