use anchor_lang::prelude::*;

#[account]
pub struct TokenRequest {
    pub config: Pubkey,
    pub maker: Pubkey,
    pub checker: Option<Pubkey>,
    pub mint: Pubkey,
    pub source_token_account: Option<Pubkey>,
    pub destination_token_account: Option<Pubkey>,
    pub amount: u64,
    pub request_type: RequestType,
    pub status: RequestStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RequestType {
    Mint,
    Transfer,
    Burn,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RequestStatus {
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

impl TokenRequest {
    pub const LEN: usize = 32 + 32 + 33 + 32 + 33 + 33 + 8 + 1 + 1;
}
