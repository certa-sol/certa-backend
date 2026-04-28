import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Supabase client singleton using the service role key.
 * Only ever use this instance for all DB operations.
 */
export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
  }
);
