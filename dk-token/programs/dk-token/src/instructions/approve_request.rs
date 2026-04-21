use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::mint_request::{MintRequest, RequestStatus};

#[derive(Accounts)]
pub struct ApproveRequest<'info> {
    #[account(mut)]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    pub checker: Signer<'info>,
}

pub fn handler(ctx: Context<ApproveRequest>) -> Result<()> {
    let request = &mut ctx.accounts.request;
    let config = &ctx.accounts.config;
    let checker = ctx.accounts.checker.key();

    // Must be pending
    require!(
        request.status == RequestStatus::Pending,
        ErrorCode::AlreadyProcessed
    );

    // Must be authorized checker
    require!(
        config.checkers.contains(&checker),
        ErrorCode::UnauthorizedChecker
    );

    // Prevent maker approving own request
    require!(checker != request.maker, ErrorCode::SelfApprovalNotAllowed);

    request.status = RequestStatus::Approved;
    request.checker = Some(checker);

    Ok(())
}
