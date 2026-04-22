import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  approve,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { DkToken } from "../target/types/dk_token";

describe("dk_token local test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DkToken as Program<DkToken>;
  const payer = (provider.wallet as any).payer as anchor.web3.Keypair;

  const admin = provider.wallet.publicKey;
  const maker = anchor.web3.Keypair.generate();
  const checker = anchor.web3.Keypair.generate();
  const recipient = anchor.web3.Keypair.generate();
  const config = anchor.web3.Keypair.generate();
  const mintKeypair = anchor.web3.Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let makerTokenAccount: anchor.web3.PublicKey;
  let recipientTokenAccount: anchor.web3.PublicKey;
  let tokenAuthority: anchor.web3.PublicKey;

  async function airdrop(publicKey: anchor.web3.PublicKey) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
  }

  before(async () => {
    await airdrop(maker.publicKey);
    await airdrop(checker.publicKey);
    await airdrop(recipient.publicKey);

    await program.methods
      .initialize()
      .accounts({
        config: config.publicKey,
        admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([config])
      .rpc();

    await program.methods
      .addChecker(checker.publicKey)
      .accounts({
        config: config.publicKey,
        admin,
      })
      .rpc();

    [tokenAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token-authority"), config.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .createTokenMint(0)
      .accounts({
        config: config.publicKey,
        mint: mintKeypair.publicKey,
        tokenAuthority,
        admin,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();

    mint = mintKeypair.publicKey;

    makerTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        maker.publicKey,
      )
    ).address;

    recipientTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        recipient.publicKey,
      )
    ).address;
  });

  it("creates a managed token mint controlled by the program authority", async () => {
    const mintAccount = await getMint(provider.connection, mint);

    assert.equal(mintAccount.address.toBase58(), mint.toBase58());
    assert.equal(mintAccount.mintAuthority?.toBase58(), tokenAuthority.toBase58());
    assert.equal(mintAccount.freezeAuthority?.toBase58(), tokenAuthority.toBase58());
    assert.equal(mintAccount.decimals, 0);
  });

  it("rotates admin, removes checker, and re-adds checker", async () => {
    const newAdmin = anchor.web3.Keypair.generate();
    await airdrop(newAdmin.publicKey);

    await program.methods
      .setAdmin(newAdmin.publicKey)
      .accounts({
        config: config.publicKey,
        admin,
      })
      .rpc();

    const configAfterAdminRotation = await program.account.config.fetch(
      config.publicKey,
    );
    assert.equal(
      configAfterAdminRotation.admin.toBase58(),
      newAdmin.publicKey.toBase58(),
    );

    await program.methods
      .removeChecker(checker.publicKey)
      .accounts({
        config: config.publicKey,
        admin: newAdmin.publicKey,
      })
      .signers([newAdmin])
      .rpc();

    let configAfterRemoval = await program.account.config.fetch(config.publicKey);
    assert.isFalse(
      configAfterRemoval.checkers.some(
        (existingChecker) => existingChecker.toBase58() === checker.publicKey.toBase58(),
      ),
    );

    await program.methods
      .addChecker(checker.publicKey)
      .accounts({
        config: config.publicKey,
        admin: newAdmin.publicKey,
      })
      .signers([newAdmin])
      .rpc();

    configAfterRemoval = await program.account.config.fetch(config.publicKey);
    assert.isTrue(
      configAfterRemoval.checkers.some(
        (existingChecker) => existingChecker.toBase58() === checker.publicKey.toBase58(),
      ),
    );
  });

  it("allows maker to cancel a pending request", async () => {
    const cancelledRequest = anchor.web3.Keypair.generate();

    await program.methods
      .createMintRequest(new anchor.BN(25))
      .accounts({
        request: cancelledRequest.publicKey,
        config: config.publicKey,
        mint,
        destinationTokenAccount: makerTokenAccount,
        maker: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker, cancelledRequest])
      .rpc();

    await program.methods
      .cancelRequest()
      .accounts({
        request: cancelledRequest.publicKey,
        config: config.publicKey,
        maker: maker.publicKey,
      })
      .signers([maker])
      .rpc();

    const storedRequest = await program.account.tokenRequest.fetch(
      cancelledRequest.publicKey,
    );

    assert.property(storedRequest.status as object, "cancelled");
  });

  it("approves a mint request and mints tokens", async () => {
    const mintRequest = anchor.web3.Keypair.generate();

    await program.methods
      .createMintRequest(new anchor.BN(1_000))
      .accounts({
        request: mintRequest.publicKey,
        config: config.publicKey,
        mint,
        destinationTokenAccount: makerTokenAccount,
        maker: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker, mintRequest])
      .rpc();

    await program.methods
      .approveRequest()
      .accounts({
        request: mintRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: null,
        destinationTokenAccount: makerTokenAccount,
        tokenAuthority,
        checker: checker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checker])
      .rpc();

    const storedRequest = await program.account.tokenRequest.fetch(
      mintRequest.publicKey,
    );
    const makerAccount = await getAccount(provider.connection, makerTokenAccount);

    assert.property(storedRequest.requestType as object, "mint");
    assert.property(storedRequest.status as object, "approved");
    assert.equal(storedRequest.checker?.toBase58(), checker.publicKey.toBase58());
    assert.equal(makerAccount.amount.toString(), "1000");
  });

  it("allows additional approved mint requests to increase supply later", async () => {
    const followUpMintRequest = anchor.web3.Keypair.generate();

    await program.methods
      .createMintRequest(new anchor.BN(250))
      .accounts({
        request: followUpMintRequest.publicKey,
        config: config.publicKey,
        mint,
        destinationTokenAccount: makerTokenAccount,
        maker: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker, followUpMintRequest])
      .rpc();

    await program.methods
      .approveRequest()
      .accounts({
        request: followUpMintRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: null,
        destinationTokenAccount: makerTokenAccount,
        tokenAuthority,
        checker: checker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checker])
      .rpc();

    const makerAccount = await getAccount(provider.connection, makerTokenAccount);
    const mintAccount = await getMint(provider.connection, mint);

    assert.equal(makerAccount.amount.toString(), "1250");
    assert.equal(mintAccount.supply.toString(), "1250");
  });

  it("approves a transfer request and moves delegated tokens", async () => {
    const transferRequest = anchor.web3.Keypair.generate();

    await approve(
      provider.connection,
      payer,
      makerTokenAccount,
      tokenAuthority,
      maker,
      400,
    );

    await program.methods
      .createTransferRequest(new anchor.BN(400))
      .accounts({
        request: transferRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: makerTokenAccount,
        destinationTokenAccount: recipientTokenAccount,
        maker: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker, transferRequest])
      .rpc();

    await program.methods
      .approveRequest()
      .accounts({
        request: transferRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: makerTokenAccount,
        destinationTokenAccount: recipientTokenAccount,
        tokenAuthority,
        checker: checker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checker])
      .rpc();

    const storedRequest = await program.account.tokenRequest.fetch(
      transferRequest.publicKey,
    );
    const makerAccount = await getAccount(provider.connection, makerTokenAccount);
    const recipientAccount = await getAccount(
      provider.connection,
      recipientTokenAccount,
    );

    assert.property(storedRequest.requestType as object, "transfer");
    assert.property(storedRequest.status as object, "approved");
    assert.equal(makerAccount.amount.toString(), "850");
    assert.equal(recipientAccount.amount.toString(), "400");
  });

  it("approves a burn request and destroys delegated tokens", async () => {
    const burnRequest = anchor.web3.Keypair.generate();

    await approve(
      provider.connection,
      payer,
      makerTokenAccount,
      tokenAuthority,
      maker,
      150,
    );

    await program.methods
      .createBurnRequest(new anchor.BN(150))
      .accounts({
        request: burnRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: makerTokenAccount,
        maker: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker, burnRequest])
      .rpc();

    await program.methods
      .approveRequest()
      .accounts({
        request: burnRequest.publicKey,
        config: config.publicKey,
        mint,
        sourceTokenAccount: makerTokenAccount,
        destinationTokenAccount: null,
        tokenAuthority,
        checker: checker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checker])
      .rpc();

    const storedRequest = await program.account.tokenRequest.fetch(
      burnRequest.publicKey,
    );
    const makerAccount = await getAccount(provider.connection, makerTokenAccount);
    const mintAccount = await getMint(provider.connection, mint);

    assert.property(storedRequest.requestType as object, "burn");
    assert.property(storedRequest.status as object, "approved");
    assert.equal(makerAccount.amount.toString(), "700");
    assert.equal(mintAccount.supply.toString(), "1100");
  });
});
