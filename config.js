/* StructCap runtime configuration.
   apiUrl  : Supabase Edge Function that handles sign-in, users, payments and the "Pro for free" switch.
   anonKey : Supabase publishable key (safe to publish; the tables are closed to it by row-level security).
   Remove apiUrl to run the site in local test mode (data kept in the browser only). */
window.STRUCTCAP_CONFIG = {
  apiUrl: 'https://roggqmvmgfxsxynulpvk.supabase.co/functions/v1/api',
  anonKey: 'sb_publishable_sshsmYNa_PSN6yC7rDW6-w_UQb_pPnR'
};
