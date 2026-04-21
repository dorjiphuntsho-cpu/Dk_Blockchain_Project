use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Request already processed")]
    AlreadyProcessed,

    #[msg("Unauthorized checker")]
    UnauthorizedChecker,

    #[msg("Maker cannot approve their own request")]
    SelfApprovalNotAllowed,

    #[msg("Invalid config account")]
    InvalidConfig,
}
