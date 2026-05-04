use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::token_request::{RequestStatus, RequestType, TokenRequest};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct CreateBurnRequest<'info> {
    #[account(
        init,
        payer = maker,
        space = 8 + TokenRequest::LEN
    )]
    pub request: Account<'info, TokenRequest>,

    pub config: Account<'info, Config>,

    pub mint: Account<'info, Mint>,

    #[account(
        constraint = source_token_account.mint == mint.key() @ ErrorCode::InvalidMint
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateBurnRequest>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts
            .config
            .has_treasury_account(&ctx.accounts.source_token_account.key()),
        ErrorCode::UnapprovedTreasuryAccount
    );

    let request = &mut ctx.accounts.request;

    request.config = ctx.accounts.config.key();
    request.maker = ctx.accounts.maker.key();
    request.checker = None;
    request.mint = ctx.accounts.mint.key();
    request.source_token_account = Some(ctx.accounts.source_token_account.key());
    request.destination_token_account = None;
    request.amount = amount;
    request.request_type = RequestType::Burn;
    request.status = RequestStatus::Pending;

    Ok(())
}
