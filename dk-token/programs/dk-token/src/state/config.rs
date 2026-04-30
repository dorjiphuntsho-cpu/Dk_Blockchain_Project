use crate::error::ErrorCode;
use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub checkers: Vec<Pubkey>,
    pub treasury_accounts: Vec<Pubkey>,
}

impl Config {
    pub const MAX_CHECKERS: usize = 10;
    pub const MAX_TREASURY_ACCOUNTS: usize = 32;
    pub const LEN: usize =
        32 + 4 + (32 * Self::MAX_CHECKERS) + 4 + (32 * Self::MAX_TREASURY_ACCOUNTS);

    pub fn has_checker(&self, candidate: &Pubkey) -> bool {
        self.checkers.iter().any(|checker| checker == candidate)
    }

    pub fn has_treasury_account(&self, candidate: &Pubkey) -> bool {
        self.treasury_accounts
            .iter()
            .any(|treasury_account| treasury_account == candidate)
    }

    pub fn add_checker(&mut self, checker: Pubkey) -> Result<()> {
        require!(
            self.checkers.len() < Self::MAX_CHECKERS,
            ErrorCode::CheckerLimitReached
        );
        require!(!self.has_checker(&checker), ErrorCode::CheckerAlreadyExists);

        self.checkers.push(checker);
        Ok(())
    }

    pub fn remove_checker(&mut self, checker: Pubkey) -> Result<()> {
        let position = self
            .checkers
            .iter()
            .position(|existing_checker| *existing_checker == checker)
            .ok_or(error!(ErrorCode::CheckerNotFound))?;

        require!(checker != self.admin, ErrorCode::CannotRemoveAdminChecker);
        self.checkers.remove(position);
        Ok(())
    }

    pub fn set_admin(&mut self, new_admin: Pubkey) -> Result<()> {
        self.admin = new_admin;

        if !self.has_checker(&new_admin) {
            self.add_checker(new_admin)?;
        }

        Ok(())
    }

    pub fn add_treasury_account(&mut self, treasury_account: Pubkey) -> Result<()> {
        require!(
            self.treasury_accounts.len() < Self::MAX_TREASURY_ACCOUNTS,
            ErrorCode::TreasuryAccountLimitReached
        );
        require!(
            !self.has_treasury_account(&treasury_account),
            ErrorCode::TreasuryAccountAlreadyExists
        );

        self.treasury_accounts.push(treasury_account);
        Ok(())
    }

    pub fn remove_treasury_account(&mut self, treasury_account: Pubkey) -> Result<()> {
        let position = self
            .treasury_accounts
            .iter()
            .position(|existing_treasury_account| *existing_treasury_account == treasury_account)
            .ok_or(error!(ErrorCode::TreasuryAccountNotFound))?;

        self.treasury_accounts.remove(position);
        Ok(())
    }
}
