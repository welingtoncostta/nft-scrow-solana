use anchor_lang::error_code;

#[error_code]
pub enum EscrowError {
    #[msg("Invalid escrow status")]
    InvalidStatus,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Wrong NFT type")]
    WrongNftType,
}