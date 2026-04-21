// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { DkToken } from "../target/types/dk_token";

// describe("dk_token local test", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace.DkToken as Program<DkToken>;

//   const config = anchor.web3.Keypair.generate();
//   const request = anchor.web3.Keypair.generate();

//   it("Initialize config", async () => {
//     await program.methods.initialize().accounts({
//       config: config.publicKey,
//       admin: provider.wallet.publicKey,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     }).signers([config]).rpc();

//     const account = await program.account.config.fetch(config.publicKey);
//     console.log("Admin:", account.admin.toString());
//   });

//   it("Create mint request", async () => {
//     await program.methods
//       .createMintRequest(new anchor.BN(1000))
//       .accounts({
//         request: request.publicKey,
//         config: config.publicKey,
//         maker: provider.wallet.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([request])
//       .rpc();

//     const req = await program.account.mintRequest.fetch(request.publicKey);
//     console.log("Request amount:", req.amount.toString());
//   });
// });