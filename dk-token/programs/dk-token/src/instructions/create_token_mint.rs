use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::error::ErrorCode;
use crate::state::config::Config;

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct CreateTokenMint<'info> {
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        mint::decimals = decimals,
        mint::authority = token_authority,
        mint::freeze_authority = token_authority
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority used as mint and freeze authority for managed mints.
    #[account(
        seeds = [b"token-authority", config.key().as_ref()],
        bump
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateTokenMint>, _decimals: u8) -> Result<()> {
    require!(
        ctx.accounts.config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    Ok(())
}
