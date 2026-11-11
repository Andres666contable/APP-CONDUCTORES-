import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ysccoexskezjtjjivznc.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_uJWDwSmY2WwQ702rKVVyFQ_dGnXGKib';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
