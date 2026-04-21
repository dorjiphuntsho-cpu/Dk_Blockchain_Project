use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

// Expose account structs to crate root
pub use instructions::*;
pub use state::*;

declare_id!("8Kxsa814MpA7dmC5HNXy53TuQ4PWyi2JhqcUhAGYczY5");

#[program]
pub mod dk_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn create_mint_request(
        ctx: Context<CreateMintRequest>,
        amount: u64,
    ) -> Result<()> {
        create_request::handler(ctx, amount)
    }

    pub fn approve_request(ctx: Context<ApproveRequest>) -> Result<()> {
        approve_request::handler(ctx)
    }

    pub fn reject_request(ctx: Context<RejectRequest>) -> Result<()> {
        reject_request::handler(ctx)
    }
}