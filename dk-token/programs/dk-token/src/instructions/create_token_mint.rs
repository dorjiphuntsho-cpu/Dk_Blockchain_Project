use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
    Metadata,
};
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

    /// CHECK: Metaplex metadata PDA for the managed mint.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateTokenMint>,
    _decimals: u8,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    require!(
        ctx.accounts.config.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    let config_key = ctx.accounts.config.key();
    let bump = ctx.bumps.token_authority;

    let signer_seeds: &[&[u8]] = &[b"token-authority", config_key.as_ref(), &[bump]];

    let signer_seeds_binding = [signer_seeds];

    let metadata_ctx = CpiContext::new_with_signer(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.token_authority.to_account_info(),
            payer: ctx.accounts.admin.to_account_info(),
            update_authority: ctx.accounts.admin.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        },
        &signer_seeds_binding,
    );

    create_metadata_accounts_v3(
        metadata_ctx,
        DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )?;

    Ok(())
}
