import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isCloudConfigured } from "./supabaseConfig";

// The Supabase client, or null when credentials haven't been pasted into
// supabaseConfig.js yet. Every caller must handle null — that's the local-only
// mode that keeps the app usable before the backend exists.
export const supabase = isCloudConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Deep links are handled manually in App.js; the SDK shouldn't also try
        // to parse the URL bar (there isn't one on native).
        detectSessionInUrl: false,
      },
    })
  : null;

export { isCloudConfigured };
