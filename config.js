/* StructCap runtime configuration.
   apiUrl     : Supabase Edge Function that handles sign-in, registration, users, payments and messages.
   anonKey    : Supabase publishable key (safe to publish; the tables are closed to it by row-level security).
   adminEmail : where registrations, Pro applications, contact and feedback are emailed.
   mailRelay  : when the server has no RESEND_API_KEY, send the email summary through FormSubmit from the browser
                (the first message asks the administrator to confirm the address). false = server email only.
   omisePublicKey : Omise public key (pkey_test_… or pkey_…) — safe to publish. Online payment (card, PromptPay, mobile banking,
                    TrueMoney) appears when this is set AND the Supabase function has the OMISE_SECRET_KEY secret.
   Remove apiUrl to run the site in local test mode (data kept in the browser only). */
window.STRUCTCAP_CONFIG = {
  apiUrl: 'https://roggqmvmgfxsxynulpvk.supabase.co/functions/v1/api',
  anonKey: 'sb_publishable_sshsmYNa_PSN6yC7rDW6-w_UQb_pPnR',
  adminEmail: 'napong.subanpong@outlook.com',
  mailRelay: true,
  omisePublicKey: ''
};
