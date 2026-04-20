use anchor_lang::prelude::*;

declare_id!("ALKdZKgXLELbiuyfgWnJupsgLtrC6puaJLKMei3Yr4Hf");

#[program]
pub mod dk_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
