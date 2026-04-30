use crate::error::ErrorCode;
use crate::state::config::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveTreasuryAccount<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveTreasuryAccount>, treasury_account: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    config.remove_treasury_account(treasury_account)
}
