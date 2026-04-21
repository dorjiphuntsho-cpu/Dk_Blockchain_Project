use anchor_lang::prelude::*;

#[account]
pub struct MintRequest {
    pub config: Pubkey,
    pub maker: Pubkey,
    pub checker: Option<Pubkey>,
    pub amount: u64,
    pub status: RequestStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RequestStatus {
    Pending,
    Approved,
    Rejected,
}
