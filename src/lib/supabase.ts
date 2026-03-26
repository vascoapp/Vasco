import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './database.types';
import { ENV, isSupabaseConfigured as _isSupabaseConfigured } from '../config/env';

/** True when both env vars are set (i.e. real Supabase is configured) */
export const isSupabaseConfigured = _isSupabaseConfigured;

/**
 * Supabase client singleton.
 * When env vars are missing the client is created with placeholder values –
 * every call will fail, but the app boots in demo mode instead.
 */
export const supabase = createClient<Database>(
  ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
  ENV.SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // not needed in React Native
    },
  },
);
