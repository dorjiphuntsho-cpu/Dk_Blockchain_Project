use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::token_request::{RequestStatus, TokenRequest};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RejectRequest<'info> {
    #[account(
        mut,
        constraint = request.config == config.key() @ ErrorCode::InvalidConfig
    )]
    pub request: Account<'info, TokenRequest>,

    pub config: Account<'info, Config>,

    pub checker: Signer<'info>,
}

pub fn handler(ctx: Context<RejectRequest>) -> Result<()> {
    let request = &mut ctx.accounts.request;
    let config = &ctx.accounts.config;
    let checker = ctx.accounts.checker.key();

    require!(
        request.status == RequestStatus::Pending,
        ErrorCode::AlreadyProcessed
    );

    require!(config.has_checker(&checker), ErrorCode::UnauthorizedChecker);

    require!(checker != request.maker, ErrorCode::SelfApprovalNotAllowed);

    request.status = RequestStatus::Rejected;
    request.checker = Some(checker);

    Ok(())
}
