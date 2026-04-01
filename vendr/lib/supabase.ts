import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://mbdojwirmtknzpwccthb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZG9qd2lybXRrbnpwd2NjdGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTkxMjEsImV4cCI6MjA4ODM3NTEyMX0.D6VG2ifvmXpCmphZf9pKazrQJaXxNofCM2NMJRk-nOM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});