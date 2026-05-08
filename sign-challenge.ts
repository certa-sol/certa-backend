import 'dotenv/config'
import { Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import fs from 'fs'

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('treasury.json', 'utf8')))
)

const challenge = process.argv[2]  // pass challenge as argument
if (!challenge) {
  console.error('Usage: tsx sign-challenge.ts "your:challenge:string"')
  process.exit(1)
}

const message = new TextEncoder().encode(challenge)
const signature = nacl.sign.detached(message, keypair.secretKey)

console.log('walletAddress:', keypair.publicKey.toString())
console.log('signature:', Buffer.from(signature).toString('base64'))