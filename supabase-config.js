// ===== Supabase connection =====
// From your Supabase project → Settings → API
const SUPABASE_URL = 'https://zebsmboungqmgrnnppev.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m5rUHoiQ3mA18-LqjaNyUQ_C0kQVETU';

// Initialise defensively so a Supabase issue can never break the page.
let sb = null;
try {
  if (
    window.supabase &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR-PROJECT') &&
    !SUPABASE_ANON_KEY.includes('YOUR-ANON')
  ) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('Supabase init failed:', e);
  sb = null;
}
