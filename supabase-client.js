import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabaseUrl = 'https://zwwdkdgivwwrbvoimtyt.supabase.co';
const supabasePublishableKey = 'sb_publishable_xbuh_lA-vRpTSOZ1NItEaw_MjVKG1No';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
