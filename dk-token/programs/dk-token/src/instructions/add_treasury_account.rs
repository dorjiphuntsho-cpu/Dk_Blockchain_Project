use crate::error::ErrorCode;
use crate::state::config::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddTreasuryAccount<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<AddTreasuryAccount>, treasury_account: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    config.add_treasury_account(treasury_account)
}
