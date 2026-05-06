import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl/dk_token.json";

export const PROGRAM_ID = new PublicKey(
  idl.address
);

export const getProgram = (wallet, connection) => {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );

  anchor.setProvider(provider);

  return new anchor.Program(idl, provider);
};