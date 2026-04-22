use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use crate::error::ErrorCode;
use crate::state::config::Config;
use crate::state::token_request::{RequestStatus, RequestType, TokenRequest};

#[derive(Accounts)]
pub struct ApproveRequest<'info> {
    #[account(
        mut,
        constraint = request.config == config.key() @ ErrorCode::InvalidConfig,
        constraint = request.mint == mint.key() @ ErrorCode::InvalidMint
    )]
    pub request: Account<'info, TokenRequest>,

    pub config: Account<'info, Config>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub source_token_account: Option<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub destination_token_account: Option<Account<'info, TokenAccount>>,

    /// CHECK: PDA authority used as mint authority and delegated transfer/burn authority.
    #[account(
        seeds = [b"token-authority", config.key().as_ref()],
        bump
    )]
    pub token_authority: UncheckedAccount<'info>,

    pub checker: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

fn validate_delegate(
    source_token_account: &TokenAccount,
    token_authority: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(
        source_token_account.delegate == COption::Some(token_authority),
        ErrorCode::InvalidDelegate
    );
    require!(
        source_token_account.delegated_amount >= amount,
        ErrorCode::InsufficientDelegation
    );

    Ok(())
}

pub fn handler(ctx: Context<ApproveRequest>) -> Result<()> {
    let request = &mut ctx.accounts.request;
    let config = &ctx.accounts.config;
    let checker = ctx.accounts.checker.key();
    let token_authority = ctx.accounts.token_authority.key();

    require!(
        request.status == RequestStatus::Pending,
        ErrorCode::AlreadyProcessed
    );

    require!(
        config.has_checker(&checker),
        ErrorCode::UnauthorizedChecker
    );

    require!(checker != request.maker, ErrorCode::SelfApprovalNotAllowed);

    let config_key = config.key();
    let bump = [ctx.bumps.token_authority];
    let signer_seeds: &[&[u8]] = &[b"token-authority", config_key.as_ref(), &bump];
    let signer = &[signer_seeds];

    match request.request_type {
        RequestType::Mint => {
            let destination_token_account = ctx
                .accounts
                .destination_token_account
                .as_ref()
                .ok_or(error!(ErrorCode::MissingDestinationAccount))?;

            require!(
                request.source_token_account.is_none(),
                ErrorCode::InvalidRequestType
            );
            require!(
                request.destination_token_account == Some(destination_token_account.key()),
                ErrorCode::InvalidDestinationAccount
            );
            require!(
                destination_token_account.mint == ctx.accounts.mint.key(),
                ErrorCode::InvalidMint
            );
            require!(
                ctx.accounts.mint.mint_authority == COption::Some(token_authority),
                ErrorCode::InvalidMintAuthority
            );

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.mint.to_account_info(),
                        to: destination_token_account.to_account_info(),
                        authority: ctx.accounts.token_authority.to_account_info(),
                    },
                    signer,
                ),
                request.amount,
            )?;
        }
        RequestType::Transfer => {
            let source_token_account = ctx
                .accounts
                .source_token_account
                .as_ref()
                .ok_or(error!(ErrorCode::MissingSourceAccount))?;
            let destination_token_account = ctx
                .accounts
                .destination_token_account
                .as_ref()
                .ok_or(error!(ErrorCode::MissingDestinationAccount))?;

            require!(
                request.source_token_account == Some(source_token_account.key()),
                ErrorCode::InvalidSourceAccount
            );
            require!(
                request.destination_token_account == Some(destination_token_account.key()),
                ErrorCode::InvalidDestinationAccount
            );
            require!(
                source_token_account.mint == ctx.accounts.mint.key()
                    && destination_token_account.mint == ctx.accounts.mint.key(),
                ErrorCode::InvalidMint
            );

            validate_delegate(source_token_account, token_authority, request.amount)?;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: source_token_account.to_account_info(),
                        to: destination_token_account.to_account_info(),
                        authority: ctx.accounts.token_authority.to_account_info(),
                    },
                    signer,
                ),
                request.amount,
            )?;
        }
        RequestType::Burn => {
            let source_token_account = ctx
                .accounts
                .source_token_account
                .as_ref()
                .ok_or(error!(ErrorCode::MissingSourceAccount))?;

            require!(
                request.source_token_account == Some(source_token_account.key()),
                ErrorCode::InvalidSourceAccount
            );
            require!(
                request.destination_token_account.is_none(),
                ErrorCode::InvalidRequestType
            );
            require!(
                source_token_account.mint == ctx.accounts.mint.key(),
                ErrorCode::InvalidMint
            );

            validate_delegate(source_token_account, token_authority, request.amount)?;

            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: source_token_account.to_account_info(),
                        authority: ctx.accounts.token_authority.to_account_info(),
                    },
                    signer,
                ),
                request.amount,
            )?;
        }
    }

    request.status = RequestStatus::Approved;
    request.checker = Some(checker);

    Ok(())
}
