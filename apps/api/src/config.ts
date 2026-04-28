import { z } from 'zod';

/**
 * Validates and exports all required environment variables for the Certa backend.
 * Throws an error with a clear message if any are missing or invalid before the server starts.
 */
const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number as a string'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  HELIUS_RPC: z.string().url(),
  HELIUS_API_KEY: z.string().min(1),
  TREASURY_WALLET: z.string().min(1),
  CERTA_AUTHORITY_KEYPAIR: z.string().refine(
    (val) => {
      try {
        const arr = JSON.parse(val);
        return Array.isArray(arr) && arr.every((n) => typeof n === 'number');
      } catch {
        return false;
      }
    },
    {
      message: 'CERTA_AUTHORITY_KEYPAIR must be a JSON array of numbers',
    }
  ),
  USDC_MINT: z.string().min(1),
  ANCHOR_PROGRAM_ID: z.string().min(1),
  ASSESSMENT_FEE_SOL: z.string().regex(/^\d+(\.\d+)?$/, 'ASSESSMENT_FEE_SOL must be a number as a string'),
  ASSESSMENT_FEE_USDC: z.string().regex(/^\d+$/, 'ASSESSMENT_FEE_USDC must be an integer as a string'),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRY: z.string().min(1),
  IRYS_NODE_URL: z.string().url(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const formatted = _env.error.format();
  const missing = Object.keys(formatted)
    .map((key) => `${key}: ${(formatted as any)[key]?._errors?.join(', ')}`)
    .join('\n');
  throw new Error(`Missing or invalid environment variables:\n${missing}`);
}

export const config = {
  PORT: parseInt(_env.data.PORT, 10),
  NODE_ENV: _env.data.NODE_ENV,
  SUPABASE_URL: _env.data.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: _env.data.SUPABASE_SERVICE_KEY,
  REDIS_URL: _env.data.REDIS_URL,
  GEMINI_API_KEY: _env.data.GEMINI_API_KEY,
  HELIUS_RPC: _env.data.HELIUS_RPC,
  HELIUS_API_KEY: _env.data.HELIUS_API_KEY,
  TREASURY_WALLET: _env.data.TREASURY_WALLET,
  CERTA_AUTHORITY_KEYPAIR: JSON.parse(_env.data.CERTA_AUTHORITY_KEYPAIR),
  USDC_MINT: _env.data.USDC_MINT,
  ANCHOR_PROGRAM_ID: _env.data.ANCHOR_PROGRAM_ID,
  ASSESSMENT_FEE_SOL: parseFloat(_env.data.ASSESSMENT_FEE_SOL),
  ASSESSMENT_FEE_USDC: parseInt(_env.data.ASSESSMENT_FEE_USDC, 10),
  JWT_SECRET: _env.data.JWT_SECRET,
  JWT_EXPIRY: _env.data.JWT_EXPIRY,
  IRYS_NODE_URL: _env.data.IRYS_NODE_URL,
};
