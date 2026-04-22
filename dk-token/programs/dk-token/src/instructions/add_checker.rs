use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::config::Config;

#[derive(Accounts)]
pub struct AddChecker<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<AddChecker>, checker: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    config.add_checker(checker)
}
