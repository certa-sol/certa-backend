"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const web3_js_1 = require("@solana/web3.js");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const fs_1 = __importDefault(require("fs"));
const keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs_1.default.readFileSync('treasury.json', 'utf8'))));
const challenge = process.argv[2]; // pass challenge as argument
if (!challenge) {
    console.error('Usage: tsx sign-challenge.ts "your:challenge:string"');
    process.exit(1);
}
const message = new TextEncoder().encode(challenge);
const signature = tweetnacl_1.default.sign.detached(message, keypair.secretKey);
console.log('walletAddress:', keypair.publicKey.toString());
console.log('signature:', Buffer.from(signature).toString('base64'));
