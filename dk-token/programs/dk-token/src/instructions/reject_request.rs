use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::mint_request::MintRequest;

#[derive(Accounts)]
pub struct RejectRequest<'info> {
    #[account(mut)]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    pub checker: Signer<'info>,
}

pub fn handler(ctx: Context<RejectRequest>) -> Result<()> {
    let request = &mut ctx.accounts.request;
    let config = &ctx.accounts.config;
    let checker = ctx.accounts.checker.key();

    require!(
        request.status == crate::state::mint_request::RequestStatus::Pending,
        ErrorCode::AlreadyProcessed
    );

    require!(
        request.config == ctx.accounts.config.key(),
        ErrorCode::InvalidConfig
    );

    require!(
        config.checkers.contains(&checker),
        ErrorCode::UnauthorizedChecker
    );

    request.status = crate::state::mint_request::RequestStatus::Rejected;
    request.checker = Some(checker);

    Ok(())
}
