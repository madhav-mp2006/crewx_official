
import { createClient } from '@supabase/supabase-js';

// The Supabase URL provided by the user
const supabaseUrl = 'https://wjvcsnuumbtsxfapklkp.supabase.co';

// The Supabase API Key (Anon Key) provided by the user
const supabaseAnonKey = 'sb_publishable_FOwhYQKni5d8L2kxtz-9hA_xNd2WVcZ';

// Initialize the client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
