import { Session, AssessmentResult } from '../types';
import { config } from '../config';
import { Keypair } from '@solana/web3.js';
import Irys from '@irys/sdk';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';
import * as fs from 'fs';
import * as path from 'path';

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
    const authority = Keypair.fromSecretKey(
      Uint8Array.from(config.CERTA_AUTHORITY_KEYPAIR)
    );

    const irys = new Irys({
      url: config.IRYS_NODE_URL,
      token: 'solana',
      key: authority,
    });

    // 1. Upload image to Arweave first
    // Place your credential image at: src/assets/credential.png
    // Recommended: 1000x1000px PNG, under 1MB
    const imagePath = path.join(__dirname, '../assets/credential.png');
    const imageData = fs.readFileSync(imagePath);
    const imageTx = await irys.upload(imageData, {
      tags: [{ name: 'Content-Type', value: 'image/png' }],
    });
    const imageUri = `https://arweave.net/${imageTx.id}`;

    // 2. Build metadata with image URI
    const metadata = {
      name: 'Certa — Solana Developer',
      symbol: 'CERTA',
      description: 'Verified Solana developer credential issued by Certa.',
      image: imageUri,                        // ← wallets and marketplaces read this
      attributes: [
        { trait_type: 'Skill', value: 'Solana Core Development' },
        { trait_type: 'Score', value: String(result.score) },
        { trait_type: 'Issued At', value: new Date().toISOString() },
        { trait_type: 'Wallet', value: session.wallet },
      ],
      properties: {
        files: [{ uri: imageUri, type: 'image/png' }],  // ← Metaplex standard
        category: 'image',
        verify_url: `https://certa.xyz/verify/${session.wallet}`,
      },
    };

    // 3. Upload metadata JSON
    const metaTx = await irys.upload(JSON.stringify(metadata), {
      tags: [{ name: 'Content-Type', value: 'application/json' }],
    });
    const uri = `https://arweave.net/${metaTx.id}`;

    // 4. Mint NFT
    const umi = createUmi(config.HELIUS_RPC);
    umi.use(mplTokenMetadata());
    umi.use({ install: () => ({ signer: authority }) });

    const mint = generateSigner(umi);

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