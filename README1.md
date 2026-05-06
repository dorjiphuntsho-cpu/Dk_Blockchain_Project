# for frontend and integration

Step 1 — Install Required Packages

Inside dk-frontend:

npm install @coral-xyz/anchor
npm install @solana/web3.js
npm install @solana/wallet-adapter-react
npm install @solana/wallet-adapter-react-ui
npm install @solana/wallet-adapter-wallets
npm install @solana/wallet-adapter-phantom
npm install @solana/spl-token


Step 2 — Copy IDL

After deployment, Anchor generated:

dk-token/target/idl/dk_token.json

Copy that file into:

dk-frontend/src/idl/dk_token.json

Create the idl folder manually if needed.

Step 3 — Setup Wallet Provider

Replace your main.jsx with your code

Step 4 — Add Wallet Button

Replace App.jsx with your code


Step 5 — Start Frontend
npm run dev


Step 6 — Create Anchor Program Connection

Create a new file:

src/utils/anchor.js

Step 7 — Add Initialize Button (Call Smart Contract)

Update App.jsx:

# add sol to your pantom account
solana airdrop 5 PASTE_ADDRESS(2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP)  


Verify it on-chain:
solana account 2SuzXkYxuh5XST2kgNax3K8A9QGtJijJQuPGWfQ1jmXG(address from browser console)

2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP

# What is Actually Minting?

Minting = increasing supply of a token.

But on Solana, tokens are NOT stored in wallets directly.

They are stored in:

🔹 Associated Token Accounts (ATA)

Structure:

Wallet
  └── Token Account (for specific mint)
         └── Balance

So when you mint:

Mint → creates new tokens
Mint authority signs
Tokens deposited into maker's ATA

 so the flow is like:
    1. Derive maker’s ATA
    2. Pass it to approveRequest
    3. Mint tokens successfully


# from test to devnet
Step 1 — Stop local validator
Ctrl + C

Step 2 — Switch CLI to devnet
solana config set --url https://api.devnet.solana.com

Check:
solana config get
Should show:

RPC URL: https://api.devnet.solana.com

Step 3 — Airdrop Devnet SOL
solana airdrop 2

If rate-limited, use:

solana airdrop 2 --url https://api.devnet.solana.com
Step 4 — Deploy program to Devnet

Inside your Anchor project:

anchor deploy --provider.cluster devnet
After deployment:

Update your frontend IDL:

Copy new IDL from:

target/idl/dk_token.json

into:

dk-frontend/src/idl/


step 5 — Change frontend endpoint

In main.jsx:

const endpoint = "https://api.devnet.solana.com";


declare_id!("8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx");

👉 This is your program ID (smart contract address)

Accounts struct is:

A blueprint of required blockchain accounts + rules + permissions


💡 What is a PDA?

A PDA (Program Derived Address) is a special Solana account that:

Has no private key
Is controlled only by your program
Is generated using:
seeds (like "mint_authority")

Why you use PDA here



Look at this:

mint::authority = mint_authority,

👉 Your token mint is owned by the PDA

So:

❌ No user controls minting
✅ Only your program can mint tokens

# Metaplex's JS SDK to create the metadata account separately, after the mint is created. This doesn't touch your program at all.

npm install @metaplex-foundation/mpl-token-metadata @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults

npm install @metaplex-foundation/js

npm install @metaplex-foundation/mpl-token-metadata

olddependencies
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = { version = "0.32.1", features = ["token"] }


# IPFS is exactly what you should use for token metadata. Let’s wire it properly into your current setup.

🚀 Step 1: Create Metadata JSON

Create a file like:

{
  "name": "DK Token",
  "symbol": "DKT",
  "description": "Decentralized academic credential token",
  "image": "https://gateway.pinata.cloud/ipfs/<IMAGE_CID>"
}

👉 Important:

image must ALSO be on IPFS
Don’t leave fields empty
🖼️ Step 2: Upload Image to IPFS

Use one of these:

🔹 Option A (Easiest): Pinata
Go to: https://www.pinata.cloud
Upload your image
You’ll get:
QmXYZ... (CID)

Your image URL becomes:

https://gateway.pinata.cloud/ipfs/QmXYZ...
📄 Step 3: Upload Metadata JSON to IPFS

Upload your JSON file to Pinata.

You’ll get another CID:

QmABC...
🔗 Step 4: Use it in your code

Replace this:

const URI = "";

with:

const URI = "https://gateway.pinata.cloud/ipfs/QmABC...";

You only need ONE format, not both.

✔ Option 1 (BEST – use IPFS URI)
const URI = "ipfs://bafkreifs63vvjazrnabs653zx3cmmqwewy3ndo3urxsue3ag2e3ajdmbry";
✔ Option 2 (Pinata gateway)
const URI = "https://gateway.pinata.cloud/ipfs/bafkreifs63vvjazrnabs653zx3cmmqwewy3ndo3urxsue3ag2e3ajdmbry";
✔ Option 3 (your custom Pinata gateway)
const URI = "https://green-realistic-nightingale-859.mypinata.cloud/ipfs/bafkreifs63vvjazrnabs653zx3cmmqwewy3ndo3urxsue3a

# port miss match
1. Find what is using port 5000

lsof -i :5000
or:

ss -ltnp | grep 5000
2. Stop old server

If lsof shows a PID, kill it:

kill <PID>