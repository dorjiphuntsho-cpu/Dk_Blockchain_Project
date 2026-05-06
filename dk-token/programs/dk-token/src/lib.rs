
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Burn, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};
7
pub mod error;
pub mod state;

use error::ErrorCode;
use state::config::Config;
use state::mint_request::{MintRequest, RequestStatus};

declare_id!("8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx");

#[program]
pub mod dk_token {
    use super::*;

    // -------------------------------------------------
    // INITIALIZE SYSTEM
    // -------------------------------------------------
    pub fn initialize(
        ctx: Context<Initialize>,
        checkers: Vec<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.mint = Pubkey::default();
        config.checkers = checkers;
        Ok(())
    }

    // -------------------------------------------------
    // CREATE MINT (PDA as authority)
    // -------------------------------------------------
    pub fn create_mint(ctx: Context<CreateMint>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            ctx.accounts.admin.key() == config.admin,

            ErrorCode::UnauthorizedChecker
        );
        config.mint = ctx.accounts.mint.key(); 
        Ok(())
}

    // -------------------------------------------------
    // MAKER CREATES MINT REQUEST
    // -------------------------------------------------
    pub fn create_mint_request(
        ctx: Context<CreateMintRequest>,
        amount: u64,
    ) -> Result<()> {
        let request = &mut ctx.accounts.request;
        request.config = ctx.accounts.config.key();
        request.maker = ctx.accounts.maker.key();
        request.checker = None;
        request.amount = amount;
        request.status = RequestStatus::Pending;
        Ok(())
    }

    // -------------------------------------------------
    // CHECKER APPROVES & PROGRAM MINTS
    // -------------------------------------------------
    pub fn approve_request(ctx: Context<ApproveRequest>) -> Result<()> {
        let request = &mut ctx.accounts.request;
        let config = &ctx.accounts.config;
        let checker = ctx.accounts.checker.key();

        require!(
            request.status == RequestStatus::Pending,
            ErrorCode::AlreadyProcessed
        );
        require!(
            config.checkers.contains(&checker),
            ErrorCode::UnauthorizedChecker
        );
        require!(
            checker != request.maker,
            ErrorCode::SelfApprovalNotAllowed
        );
        require!(
            config.mint == ctx.accounts.mint.key(),
            ErrorCode::InvalidConfig
        );

        let bump = ctx.bumps.mint_authority;
        let seeds: &[&[u8]] = &[b"mint_authority", &[bump]];
        let signer = &[seeds];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.maker_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            request.amount,
        )?;

        request.status = RequestStatus::Approved;
        request.checker = Some(checker);
        Ok(())
    }

    // -------------------------------------------------
    // CHECKER REJECTS
    // -------------------------------------------------
    pub fn reject_request(ctx: Context<RejectRequest>) -> Result<()> {
        let request = &mut ctx.accounts.request;
        let config = &ctx.accounts.config;
        let checker = ctx.accounts.checker.key();

        require!(
            request.status == RequestStatus::Pending,
            ErrorCode::AlreadyProcessed
        );
        require!(
            config.checkers.contains(&checker),
            ErrorCode::UnauthorizedChecker
        );

        request.status = RequestStatus::Rejected;
        request.checker = Some(checker);
        Ok(())
    }

    // -------------------------------------------------
    // P2P TRANSFER (direct, no approval)
    // -------------------------------------------------
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.from_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        Ok(())
    }

    // -------------------------------------------------
    // BURN TOKENS (direct, no approval)
    // -------------------------------------------------
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
            ),
            amount,
        )?;

        Ok(())
    }
}

// =====================================================
// ACCOUNTS
// =====================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 32 + (4 + 32 * 10))]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        mint::decimals = 6,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA mint authority
    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMintRequest<'info> {
    #[account(
        init,
        payer = maker,
        space = 8 + 32 + 32 + 33 + 8 + 1
    )]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveRequest<'info> {
    #[account(mut)]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub maker_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA mint authority
    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    pub checker: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RejectRequest<'info> {
    #[account(mut)]
    pub request: Account<'info, MintRequest>,

    pub config: Account<'info, Config>,

    pub checker: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub to_token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub sender: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}