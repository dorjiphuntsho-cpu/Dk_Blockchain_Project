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

    #[msg("Mint amount must be greater than zero")]
    InvalidAmount,

    #[msg("Invalid mint account")]
    InvalidMint,

    #[msg("Invalid destination token account")]
    InvalidDestinationAccount,

    #[msg("Mint authority does not match the program authority")]
    InvalidMintAuthority,

    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,

    #[msg("Checker already exists")]
    CheckerAlreadyExists,

    #[msg("Checker limit reached")]
    CheckerLimitReached,

    #[msg("Invalid source token account")]
    InvalidSourceAccount,

    #[msg("Source token account must be owned by the maker")]
    InvalidSourceOwner,

    #[msg("Source and destination token accounts must be different")]
    SameSourceAndDestination,

    #[msg("Missing source token account")]
    MissingSourceAccount,

    #[msg("Missing destination token account")]
    MissingDestinationAccount,

    #[msg("Request type does not match the provided accounts")]
    InvalidRequestType,

    #[msg("Program authority is not the delegated token authority")]
    InvalidDelegate,

    #[msg("Delegated amount is lower than the requested amount")]
    InsufficientDelegation,

    #[msg("Checker not found")]
    CheckerNotFound,

    #[msg("Admin checker cannot be removed")]
    CannotRemoveAdminChecker,

    #[msg("Only the maker can cancel this request")]
    UnauthorizedMaker,

    #[msg("Treasury account already exists")]
    TreasuryAccountAlreadyExists,

    #[msg("Treasury account not found")]
    TreasuryAccountNotFound,

    #[msg("Treasury account limit reached")]
    TreasuryAccountLimitReached,

    #[msg("Token account is not an approved treasury account")]
    UnapprovedTreasuryAccount,
}
