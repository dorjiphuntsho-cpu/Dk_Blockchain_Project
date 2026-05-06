import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DkToken } from "../target/types/dk_token";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

describe("dk_token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DkToken as Program<DkToken>;

  // Keypairs
  const admin = provider.wallet;
  const configKeypair = anchor.web3.Keypair.generate();
  const mintKeypair = anchor.web3.Keypair.generate();
  const makerKeypair = anchor.web3.Keypair.generate();
  const checkerKeypair = anchor.web3.Keypair.generate();
  const userKeypair = anchor.web3.Keypair.generate();
  const requestKeypair = anchor.web3.Keypair.generate();

  // PDA
  const [mintAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId
  );

  // Token accounts (derived later)
  let makerTokenAccount: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to maker, checker, user
    for (const keypair of [makerKeypair, checkerKeypair, userKeypair]) {
      const sig = await provider.connection.requestAirdrop(
        keypair.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Derive associated token accounts
    makerTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      makerKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    userTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
  });

  // -------------------------------------------------------
  it("1. Initialize config", async () => {
    await program.methods
      .initialize([checkerKeypair.publicKey])
      .accounts({
        config: configKeypair.publicKey,
        admin: admin.publicKey,
      })
      .signers([configKeypair])
      .rpc();

    const config = await program.account.config.fetch(configKeypair.publicKey);
    console.log("✅ Admin:", config.admin.toBase58());
    console.log("✅ Checkers:", config.checkers.map((c) => c.toBase58()));
  });

  // -------------------------------------------------------
  it("2. Create mint (PDA as authority)", async () => {
    await program.methods
      .createMint()
      .accounts({
        config: configKeypair.publicKey,
        mint: mintKeypair.publicKey,
        admin: admin.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([mintKeypair])
      .rpc();

    const config = await program.account.config.fetch(configKeypair.publicKey);
    console.log("✅ Mint:", config.mint.toBase58());
  });

  // -------------------------------------------------------
  it("3. Create maker token account", async () => {
    const ix = createAssociatedTokenAccountInstruction(
      admin.publicKey,       // payer
      makerTokenAccount,     // ATA address
      makerKeypair.publicKey, // owner
      mintKeypair.publicKey, // mint
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx);
    console.log("✅ Maker token account:", makerTokenAccount.toBase58());
  });

  // -------------------------------------------------------
  it("4. Maker creates mint request (1000 tokens)", async () => {
    await program.methods
      .createMintRequest(new anchor.BN(1000 * 10 ** 6)) // 1000 tokens with 6 decimals
      .accounts({
        request: requestKeypair.publicKey,
        config: configKeypair.publicKey,
        maker: makerKeypair.publicKey,
      })
      .signers([requestKeypair, makerKeypair])
      .rpc();

    const request = await program.account.mintRequest.fetch(
      requestKeypair.publicKey
    );
    console.log("✅ Request status:", request.status);
    console.log("✅ Maker:", request.maker.toBase58());
    console.log("✅ Amount:", request.amount.toString());
  });

  // -------------------------------------------------------
  it("5. Checker approves request → tokens minted to maker", async () => {
    await program.methods
      .approveRequest()
      .accounts({
        request: requestKeypair.publicKey,
        config: configKeypair.publicKey,
        mint: mintKeypair.publicKey,
        makerTokenAccount,
        checker: checkerKeypair.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([checkerKeypair])
      .rpc();

    const request = await program.account.mintRequest.fetch(
      requestKeypair.publicKey
    );
    console.log("✅ Approved by:", request.checker?.toBase58());
    console.log("✅ Status:", request.status);
  });

  // -------------------------------------------------------
  it("6. Create user token account", async () => {
    const ix = createAssociatedTokenAccountInstruction(
      admin.publicKey,
      userTokenAccount,
      userKeypair.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx);
    console.log("✅ User token account:", userTokenAccount.toBase58());
  });

  // -------------------------------------------------------
  it("7. Maker transfers 100 tokens to user (P2P)", async () => {
    await program.methods
      .transferTokens(new anchor.BN(100 * 10 ** 6)) // 100 tokens
      .accounts({
        fromTokenAccount: makerTokenAccount,
        toTokenAccount: userTokenAccount,
        mint: mintKeypair.publicKey,
        sender: makerKeypair.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([makerKeypair])
      .rpc();

    console.log("✅ Transfer complete — 100 DKT sent to user");
  });

  // -------------------------------------------------------
  it("8. User burns 50 tokens", async () => {
    await program.methods
      .burnTokens(new anchor.BN(50 * 10 ** 6)) // 50 tokens
      .accounts({
        mint: mintKeypair.publicKey,
        userTokenAccount,
        user: userKeypair.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    console.log("✅ User burned 50 DKT");
  });
});