import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key: safe in the client, and the row-level
// security policies in sql/sensor_errors.sql are what actually
// decide what it may read and write.
export const SUPABASE_URL = "https://sjokemojlhvwsiexnlcn.supabase.co";
export const SUPABASE_KEY = "sb_publishable_bxneUVEnXbVkNdPPST-i7w_dmv2sKpl";

export const TABLE       = "sensor_data";
export const ERROR_TABLE = "sensor_errors";
export const STATE_TABLE = "device_state";

export const HISTORY            = 48;      // readings kept for the sparklines
export const ERROR_LIMIT        = 200;
export const ERROR_ACTIVE_MS    = 10 * 60 * 1000;
export const CONNECTION_TIMEOUT = 10000;
export const FALLBACK_MS        = 7000;

// A command is only believed once the board reports the fan actually
// moved. It polls every 5s and then sleeps 5s, so the worst honest
// round trip is about 10s — past 20s something is genuinely wrong.
export const CONFIRM_TIMEOUT = 20000;

export const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
