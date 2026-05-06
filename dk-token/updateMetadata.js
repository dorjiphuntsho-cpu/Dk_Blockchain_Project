import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import pkg from "@metaplex-foundation/mpl-token-metadata";

const {
  createUpdateMetadataAccountV2Instruction,
  PROGRAM_ID,
} = pkg;

import fs from "fs";

// Load wallet keypair
const secret = JSON.parse(
  fs.readFileSync(
    "/home/tandin/.config/solana/meta-updater.json"
  )
);

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(secret)
);

// Connect to Devnet
const connection = new Connection(
  clusterApiUrl("devnet"),
  "confirmed"
);

// SPL Token Mint Address
const mintAddress = new PublicKey(
  "8GcigsNHpxk7hwM5DChg699BnH89QgRNimZMEuWg6VZy"
);

// Derive Metadata PDA
const [metadataPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),
    PROGRAM_ID.toBuffer(),
    mintAddress.toBuffer(),
  ],
  PROGRAM_ID
);

// Metadata JSON URI
const newUri =
  "https://gateway.pinata.cloud/ipfs/bafkreib2e45g637bv4mksc2eik7rbwdceb7ueg2em3ifhsay24hebqeszu";

async function update() {
  try {
    console.log(
      "Wallet:",
      wallet.publicKey.toBase58()
    );

    const balance = await connection.getBalance(
      wallet.publicKey
    );

    console.log(
      "Balance:",
      balance / 1e9,
      "SOL"
    );

    console.log(
      "Metadata PDA:",
      metadataPda.toBase58()
    );

    const instruction =
      createUpdateMetadataAccountV2Instruction(
        {
          metadata: metadataPda,
          updateAuthority: wallet.publicKey,
        },
        {
          updateMetadataAccountArgsV2: {
            data: {
              name: "BTN COIN",
              symbol: "BTN",
              uri: newUri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },

            updateAuthority: wallet.publicKey,
            primarySaleHappened: null,
            isMutable: true,
          },
        }
      );

    const transaction = new Transaction().add(
      instruction
    );

    const signature =
      await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );

    console.log(
      "Metadata updated successfully"
    );

    console.log(
      "Transaction Signature:",
      signature
    );
  } catch (error) {
    console.error(
      "Update failed:"
    );

    console.error(error);
  }
}

update();