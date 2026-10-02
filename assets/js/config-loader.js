// Browser-friendly config loader. Keep your anon key only; never use service_role here.
export const SUPABASE_CONFIG = window.__MYSTERY_SUPABASE_CONFIG__ || {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};

export const isConfigured = () => {
  return SUPABASE_CONFIG.url.includes("YOUR-PROJECT") === false &&
         SUPABASE_CONFIG.anonKey.includes("YOUR_SUPABASE") === false;
};
