                DK Token Program
                      │
                      │ controls
                      ▼
                    PDA
                      │
                      │ mint authority
                      ▼
              DK Token Mint Account
                      │
                      │ creates tokens into
                      ▼
          User's Associated Token Account
                      │
                      │ owned by
                      ▼
              User's Phantom Wallet


Meaning:

PDA controls minting.
Mint Account defines the token.
ATA stores the user's token balance.
Phantom wallet owns the ATA.


Full Flow in Your DK Token System
Step 1: Admin Initializes the System

The admin connects Phantom wallet.

Admin Phantom Wallet
        ↓
Calls initialize()
        ↓
Creates system config
        ↓
Stores admin and checker addresses

Example:

Admin = Dorji wallet
Checkers = Checker 1 wallet, Checker 2 wallet

Purpose:

To set who can approve mint requests.
Step 2: Admin Creates the DK Token Mint

The admin creates the mint account.

Admin
  ↓
create_mint()
  ↓
DK Token Mint Account is created

But the admin should not be the long-term mint authority.

Instead:

Mint Authority = PDA

So the mint account becomes:

DK Token Mint
-------------
Decimals: 6
Mint authority: PDA
Total supply: 0 initially

Presentation line:

The mint account defines DK Token, but the PDA controls who can create new DK Tokens.
Step 3: User Connects Phantom Wallet

The maker/user connects Phantom wallet from frontend.

User opens React frontend
        ↓
Connects Phantom wallet
        ↓
Frontend gets user's public key

Example:

User wallet = 7ABC...XYZ

This wallet address is used as the requester.

Step 4: User Creates Mint Request

The user wants 100 DKT.

User Phantom Wallet
        ↓
create_mint_request(100)
        ↓
Request account is created

The request stores:

Requester wallet address
Amount requested
Status = Pending
Approved by = none

Example:

Mint Request
------------
Requester: Dorji Phantom wallet
Amount: 100 DKT
Status: Pending

At this point:

No token is minted yet.

Only a request is created.

Step 5: Checker Reviews Request

Checker connects their Phantom wallet.

Checker Phantom Wallet
        ↓
Views pending requests
        ↓
Approves or rejects

The program checks:

Is this wallet a valid checker?

If yes, checker can approve.

If no, transaction fails.

Presentation line:

Checker wallet is used for approval, but checker does not directly mint tokens.
Step 6: Program Finds or Creates User ATA

Before tokens can be minted to the user, the user must have an ATA for DK Token.

User Phantom Wallet + DK Token Mint = User's DK Token ATA

If ATA exists:

Use existing ATA

If ATA does not exist:

Create ATA first

Solana recommends using the Associated Token Program because it creates a deterministic default token account for a given owner and mint, making it easier for wallets and applications to find.

Step 7: PDA Mints Tokens into User ATA

After checker approval, your program calls minting logic.

Checker approves
        ↓
Program verifies checker
        ↓
Program uses PDA as mint authority
        ↓
PDA signs internally
        ↓
Tokens are minted into user's ATA

Technical meaning:

mint_to(
  mint = DK Token Mint,
  destination = User's DK Token ATA,
  authority = PDA
)

Important:

Tokens are not minted to the mint address.
Tokens are not minted to the PDA.
Tokens are not minted directly to Phantom wallet.
Tokens are minted to the user's ATA.

Correct:

DK Token Mint → User's ATA
Step 8: Phantom Wallet Displays Token Balance

After minting:

User's ATA balance = 100 DKT

Phantom wallet checks the token account and displays the balance.

Phantom Wallet
        ↓
Reads user's ATA
        ↓
Shows 100 DKT

So Phantom is like the user interface for the wallet.

The actual balance is stored on-chain in the ATA.