use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub checkers: Vec<Pubkey>,
}
