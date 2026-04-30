use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::token_request::{RequestStatus, TokenRequest};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelRequest<'info> {
    #[account(
        mut,
        constraint = request.config == config.key() @ ErrorCode::InvalidConfig
    )]
    pub request: Account<'info, TokenRequest>,

    pub config: Account<'info, Config>,

    pub maker: Signer<'info>,
}

pub fn handler(ctx: Context<CancelRequest>) -> Result<()> {
    let request = &mut ctx.accounts.request;
    let maker = ctx.accounts.maker.key();

    require!(request.maker == maker, ErrorCode::UnauthorizedMaker);
    require!(
        request.status == RequestStatus::Pending,
        ErrorCode::AlreadyProcessed
    );

    request.status = RequestStatus::Cancelled;
    request.checker = None;

    Ok(())
}
