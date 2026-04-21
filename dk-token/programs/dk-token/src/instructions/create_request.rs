use anchor_lang::prelude::*;
use crate::state::config::Config;
use crate::state::mint_request::{MintRequest, RequestStatus};

#[derive(Accounts)]
pub struct CreateMintRequest<'info> {
    #[account(
        init,
        payer = maker,
        space = 8  // discriminator
            + 32   // config
            + 32   // maker
            + 33   // Option<Pubkey>
            + 8    // amount
            + 1    // status
    )]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMintRequest>, amount: u64) -> Result<()> {
    let request = &mut ctx.accounts.request;

    request.config = ctx.accounts.config.key();
    request.maker = ctx.accounts.maker.key();
    request.checker = None;
    request.amount = amount;
    request.status = RequestStatus::Pending;

    Ok(())
}
