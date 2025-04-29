import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env

// Ensure environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
// Service role key is only needed server-side, so we don't throw error globally here
// We will check for it specifically when creating the server client.

// Client for browser-side operations (uses anon key)
// Note: This client instance isn't directly used by the server,
// but the frontend JS will need these credentials.
// We export the credentials for potential use in HTML templates or frontend config.
export const supabaseBrowserCredentials = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

// Client for server-side operations (uses service role key for elevated privileges)
// This function creates a new client instance potentially using the service role key.
export function getSupabaseServerClient() {
  if (!supabaseServiceRoleKey) {
    // Throw error immediately if trying to create server client without the key
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. Required for server-side admin actions.");
  }
  // Create a new client instance for each server-side request or operation
  // using the service role key grants admin privileges.
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      // Avoid persisting session/user details when using service role key
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Export the function to get the server client and browser credentials
// export default { getSupabaseServerClient, supabaseBrowserCredentials };
