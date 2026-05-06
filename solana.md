

<!-- MAIN FRINTEND FILE (main.jsx)-->
<!-- Blockchian connection and Wallet access and singning ability -->
<!-- @solana/wallet-adapter-react(import extension)--> 
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

import "@solana/wallet-adapter-react-ui/styles.css";



<!-- utils/anchor.js -->

<!-- This is the bridge. -->

import { Program } from "@coral-xyz/anchor";
import idl from "../idl/dk_token.json";

export const getProgram = (wallet, connection) => {
  const provider = new AnchorProvider(connection, wallet, {});
  return new Program(idl, programId, provider);
};

This file does:

Reads IDL
Connects wallet
Creates Anchor Provider
Returns program


<!-- An associated token account (ATA)  -->

Is the default token account for a wallet and mint. The Associated Token Program derives the ATA address from the wallet address, token program address, and mint address.

<!-- Program Derived Addresses (PDAs)  -->
Addresses that are deterministically derived from a program ID and a set of seeds.
No private key exist


<!-- 1. What is a PDA (Program Derived Address)? -->
A PDA is an address:

Deterministically generated from:
seeds
program ID
❌ Has no private key
✔ Can only be controlled by your program
🔑 Why PDAs exist

They let your program:

👉 “own” accounts
👉 act like a smart contract wallet

<!-- This means: -->
User → requests mint
Checker → approves
PDA (program) → actually mints tokens



<!-- What is ATA (Associated Token Account)? -->
An ATA is:

👉 A token account tied to:

a wallet (owner)
a mint (token type)
📦 Think of it like
Wallet = person
Mint = currency
ATA = bank account for that currency



<!-- system with PDA -->
1. Maker → create request
2. Checker → approve
3. Program verifies:
   ✔ is checker valid?
   ✔ is request pending?
4. PDA signs → mint happens

<!-- Analogy (makes it click instantly) -->

Maker = person applying for loan

Checker = bank officer approving

PDA = central bank printing money
<!-- Officer can approve -->
<!-- BUT cannot print money -->
<!-- Only central bank (PDA) can issue it -->

<!-- One-line memory trick -->
👉 ATA = where tokens live
👉 PDA = who controls tokens

<!-- Important rule -->
If no ATA exists, tokens have nowhere to go → the transaction fails.

<!-- Solana tokens are not stored in wallets directly -->
They are stored in:

Token Accounts (usually ATA)