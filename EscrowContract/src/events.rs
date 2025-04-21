use anchor_lang::prelude::*;

#[event]
pub struct NftRegisteredEvent {
    #[index]
    pub owner: Pubkey,
    #[index]
    pub mint: Pubkey,
    pub batch_id: String,
    pub is_compressed: bool,
}

#[event]
pub struct NftStatusUpdatedEvent {
    #[index]
    pub mint: Pubkey,
    pub batch_id: String,
    pub new_status: EscrowStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum EscrowStatus {
    Registered,
    InEscrow,
    Sold,
    Returned,
    Failed,
}