import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DkToken } from "../target/types/dk_token";

describe("dk-token", () => {
  // Configure the client to use the local cluster.sdfghgfdsdfghj
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dkToken as Program<DkToken>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
