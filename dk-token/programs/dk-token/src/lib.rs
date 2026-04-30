use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

// Expose account structs to crate root
pub use instructions::*;
pub use state::*;

declare_id!("CYVB8pDzTLmyUgxSnjtbzxHyd2habRMa3KMgNfpM5KSW");

#[program]
pub mod dk_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn add_checker(ctx: Context<AddChecker>, checker: Pubkey) -> Result<()> {
        add_checker::handler(ctx, checker)
    }

    pub fn add_treasury_account(
        ctx: Context<AddTreasuryAccount>,
        treasury_account: Pubkey,
    ) -> Result<()> {
        add_treasury_account::handler(ctx, treasury_account)
    }

    pub fn remove_checker(ctx: Context<RemoveChecker>, checker: Pubkey) -> Result<()> {
        remove_checker::handler(ctx, checker)
    }

    pub fn remove_treasury_account(
        ctx: Context<RemoveTreasuryAccount>,
        treasury_account: Pubkey,
    ) -> Result<()> {
        remove_treasury_account::handler(ctx, treasury_account)
    }

    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        set_admin::handler(ctx, new_admin)
    }

    pub fn create_mint_request(ctx: Context<CreateMintRequest>, amount: u64) -> Result<()> {
        create_request::handler(ctx, amount)
    }

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        decimals: u8,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        create_token_mint::handler(ctx, decimals, name, symbol, uri)
    }

    pub fn create_transfer_request(ctx: Context<CreateTransferRequest>, amount: u64) -> Result<()> {
        create_transfer_request::handler(ctx, amount)
    }

    pub fn create_burn_request(ctx: Context<CreateBurnRequest>, amount: u64) -> Result<()> {
        create_burn_request::handler(ctx, amount)
    }

    pub fn approve_request(ctx: Context<ApproveRequest>) -> Result<()> {
        approve_request::handler(ctx)
    }

    pub fn reject_request(ctx: Context<RejectRequest>) -> Result<()> {
        reject_request::handler(ctx)
    }

    pub fn cancel_request(ctx: Context<CancelRequest>) -> Result<()> {
        cancel_request::handler(ctx)
    }
}
