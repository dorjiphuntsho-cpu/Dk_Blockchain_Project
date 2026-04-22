use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::config::Config;

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    config.set_admin(new_admin)
}
