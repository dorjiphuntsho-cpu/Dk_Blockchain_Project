use crate::error::ErrorCode;
use crate::state::config::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveChecker<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveChecker>, checker: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    config.remove_checker(checker)
}
