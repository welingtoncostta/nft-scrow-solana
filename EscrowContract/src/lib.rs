use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount},
    metadata::{self, Metadata},
};
use mpl_bubblegum::state::{TreeConfig, leaf_schema::LeafSchema};

declare_id!("ESCROW_PROGRAM_ID");

#[program]
pub mod nft_escrow {
    use super::*;

    // Inicializar o estado global do programa
    pub fn initialize(ctx: Context<Initialize>, admin_fee_basis_points: u16) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.authority = ctx.accounts.authority.key();
        global_state.fee_basis_points = admin_fee_basis_points;
        global_state.bump = *ctx.bumps.get("global_state").unwrap();
        Ok(())
    }

    // Criar registro de lote para rastrear um conjunto de NFTs no processo de escrow
    pub fn create_batch(ctx: Context<CreateBatch>, batch_id: String) -> Result<()> {
        let batch = &mut ctx.accounts.batch;
        batch.owner = ctx.accounts.owner.key();
        batch.batch_id = batch_id;
        batch.status = BatchStatus::Created;
        batch.created_at = Clock::get()?.unix_timestamp;
        batch.bump = *ctx.bumps.get("batch").unwrap();
        Ok(())
    }

    // Registrar um NFT no sistema de escrow
    pub fn register_nft(
        ctx: Context<RegisterNft>,
        batch_id: String,
        is_compressed: bool,
        metadata_uri: Option<String>,
        price: Option<u64>,
    ) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;
        escrow_state.owner = ctx.accounts.owner.key();
        escrow_state.mint = ctx.accounts.mint.key();
        escrow_state.batch_id = batch_id;
        escrow_state.is_compressed = is_compressed;
        escrow_state.status = EscrowStatus::Registered;
        escrow_state.metadata_uri = metadata_uri;
        escrow_state.price = price;
        escrow_state.bump = *ctx.bumps.get("escrow_state").unwrap();

        emit!(NftRegisteredEvent {
            owner: ctx.accounts.owner.key(),
            mint: ctx.accounts.mint.key(),
            batch_id,
            is_compressed,
        });

        Ok(())
    }

    // Transferir um NFT padrão para escrow usando autoridade delegada
    pub fn transfer_standard_nft_to_escrow(ctx: Context<TransferStandardNftToEscrow>) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;
        require_eq!(escrow_state.status, EscrowStatus::Registered, EscrowError::InvalidStatus);
        require_eq!(escrow_state.is_compressed, false, EscrowError::WrongNftType);

        // Transferir o NFT do usuário para a conta de escrow
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.delegate_authority.to_account_info(),
                },
                &[&[
                    b"delegate",
                    escrow_state.owner.as_ref(),
                    escrow_state.mint.as_ref(),
                    &[ctx.accounts.delegate_authority_bump],
                ]],
            ),
            1, // NFTs sempre têm quantidade = 1
        )?;

        // Atualizar estado do escrow
        escrow_state.status = EscrowStatus::InEscrow;

        emit!(NftStatusUpdatedEvent {
            mint: escrow_state.mint,
            batch_id: escrow_state.batch_id.clone(),
            new_status: EscrowStatus::InEscrow,
        });

        Ok(())
    }

    // Transferir um cNFT para escrow usando autoridade delegada
    pub fn transfer_compressed_nft_to_escrow(
        ctx: Context<TransferCompressedNftToEscrow>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        // Verificar estado do NFT
        let escrow_state = &mut ctx.accounts.escrow_state;
        require_eq!(escrow_state.status, EscrowStatus::Registered, EscrowError::InvalidStatus);
        require_eq!(escrow_state.is_compressed, true, EscrowError::WrongNftType);

        // Chamada CPI para Bubblegum (simplificada - implementação real precisaria construir corretamente)
        bubblegum::delegate_transfer(/* parâmetros relevantes */)?;

        // Atualizar estado do escrow
        escrow_state.status = EscrowStatus::InEscrow;

        emit!(NftStatusUpdatedEvent {
            mint: escrow_state.mint,
            batch_id: escrow_state.batch_id.clone(),
            new_status: EscrowStatus::InEscrow,
        });

        Ok(())
    }

    // Transferir NFT padrão do escrow (venda ou devolução)
    pub fn transfer_standard_nft_from_escrow(
        ctx: Context<TransferStandardNftFromEscrow>,
        is_sale: bool,
    ) -> Result<()> {
        // Verificações de estado e autoridade
        let escrow_state = &mut ctx.accounts.escrow_state;
        require_eq!(escrow_state.status, EscrowStatus::InEscrow, EscrowError::InvalidStatus);

        if is_sale {
            require_eq!(
                ctx.accounts.authority.key(),
                ctx.accounts.global_state.authority,
                EscrowError::Unauthorized
            );
        } else {
            require_eq!(
                ctx.accounts.authority.key(),
                escrow_state.owner,
                EscrowError::Unauthorized
            );
        }

        // Transferir NFT
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                &[&[
                    b"escrow",
                    escrow_state.owner.as_ref(),
                    escrow_state.mint.as_ref(),
                    &[ctx.accounts.escrow_authority_bump],
                ]],
            ),
            1,
        )?;

        // Atualizar estado
        escrow_state.status = if is_sale { EscrowStatus::Sold } else { EscrowStatus::Returned };

        emit!(NftStatusUpdatedEvent {
            mint: escrow_state.mint,
            batch_id: escrow_state.batch_id.clone(),
            new_status: escrow_state.status,
        });

        Ok(())
    }

    // Função similar para transferência de cNFTs do escrow
    pub fn transfer_compressed_nft_from_escrow(/* ... */) -> Result<()> {
        // Implementação similar à transferência de NFT padrão,
        // mas usando APIs do Bubblegum para cNFTs
        Ok(())
    }
}

// Definições de estruturas de conta
#[account]
pub struct GlobalState {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
    pub bump: u8,
}

#[account]
pub struct BatchState {
    pub owner: Pubkey,
    pub batch_id: String,
    pub status: BatchStatus,
    pub created_at: i64,
    pub total_nfts: u32,
    pub processed_nfts: u32,
    pub bump: u8,
}

#[account]
pub struct EscrowState {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub batch_id: String,
    pub is_compressed: bool,
    pub status: EscrowStatus,
    pub metadata_uri: Option<String>,
    pub price: Option<u64>,
    pub created_at: i64,
    pub bump: u8,
}

// Enums para status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum BatchStatus {
    Created,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum EscrowStatus {
    Registered,
    InEscrow,
    Sold,
    Returned,
    Failed,
}

// Contextos de instrução
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 2 + 1,
        seeds = [b"global"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(batch_id: String)]
pub struct CreateBatch<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 64 + 1 + 8 + 4 + 4 + 1,
        seeds = [b"batch", owner.key().as_ref(), batch_id.as_bytes()],
        bump
    )]
    pub batch: Account<'info, BatchState>,

    #[account(seeds = [b"global"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

// Definições dos outros contextos e estruturas de eventos omitidas para brevidade