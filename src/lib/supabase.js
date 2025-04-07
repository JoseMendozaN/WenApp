import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Configuración segura usando variables de entorno
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://jjnsdvbmjopxqeplbzab.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbnNkdmJtam9weHFlcGxiemFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4MzE2MDcsImV4cCI6MjA1ODQwNzYwN30.g78wBxd6WFyfDP4gF9UMyl6CDsUGVaaALJs_EGI0eXo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Funciones de utilidad
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
