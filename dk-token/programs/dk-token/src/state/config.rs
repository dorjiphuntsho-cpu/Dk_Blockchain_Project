use anchor_lang::prelude::*;
use crate::error::ErrorCode;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub checkers: Vec<Pubkey>,
}

impl Config {
    pub const MAX_CHECKERS: usize = 10;
    pub const LEN: usize = 32 + 4 + (32 * Self::MAX_CHECKERS);

    pub fn has_checker(&self, candidate: &Pubkey) -> bool {
        self.checkers.iter().any(|checker| checker == candidate)
    }

    pub fn add_checker(&mut self, checker: Pubkey) -> Result<()> {
        require!(
            self.checkers.len() < Self::MAX_CHECKERS,
            ErrorCode::CheckerLimitReached
        );
        require!(
            !self.has_checker(&checker),
            ErrorCode::CheckerAlreadyExists
        );

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
}
