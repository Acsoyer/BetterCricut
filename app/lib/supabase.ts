import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpjlfrfignozoldqnqft.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MHBQEEt1oWki_dwUAgMZig_nlaqRKyv";

export const supabase = createClient(url, publishableKey);
