import { Session, AssessmentResult } from '../types';
import { config } from '../config';
import { createCredential } from '../db/credentials';
import { Keypair, PublicKey } from '@solana/web3.js';
import Irys from '@irys/sdk';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';

export class MintError extends Error {}

/**
 * Uploads credential metadata to Arweave via Irys and mints
 * a non-transferable Metaplex NFT to the developer's wallet.
 * @returns The mint address of the newly created NFT
 * @throws MintError if upload or minting fails
 */
export async function mintCredential(
  session: Session,
  result: AssessmentResult
): Promise<string> {
  try {
    // 1. Build metadata
    const metadata = {
      name: 'Certa — Solana Developer',
      symbol: 'CERTA',
      description: 'Verified Solana developer credential issued by Certa.',
      attributes: [
        { trait_type: 'Skill', value: 'Solana Core Development' },
        { trait_type: 'Score', value: String(result.score) },
        { trait_type: 'Issued At', value: new Date().toISOString() },
        { trait_type: 'Wallet', value: session.wallet },
      ],
      properties: {
        verify_url: `https://certa.xyz/verify/${session.wallet}`,
      },
    };
    // 2. Upload to Arweave via Irys
    const irys = new Irys({
      url: config.IRYS_NODE_URL,
      token: 'solana',
      key: Keypair.fromSecretKey(Uint8Array.from(config.CERTA_AUTHORITY_KEYPAIR)),
    });
    const txId = await irys.upload(JSON.stringify(metadata), {
      tags: [{ name: 'Content-Type', value: 'application/json' }],
    });
    const uri = `https://arweave.net/${txId}`;
    // 3. Mint NFT
    const umi = createUmi(config.HELIUS_RPC);
    umi.use(mplTokenMetadata());
    const mint = generateSigner(umi);
    const authority = Keypair.fromSecretKey(Uint8Array.from(config.CERTA_AUTHORITY_KEYPAIR));
    umi.use({ install: () => ({ signer: authority }) });
    await createNft(umi, {
      mint,
      uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: percentAmount(0),
      isMutable: false,
      tokenOwner: publicKey(session.wallet),
    }).sendAndConfirm(umi);
    return mint.publicKey;
  } catch (e) {
    throw new MintError((e as Error).message);
  }
}
