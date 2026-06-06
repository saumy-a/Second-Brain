// Provide WebSocket support for Node.js versions < 22
if (typeof global.WebSocket === "undefined") {
  global.WebSocket = require("ws");
}

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ MISSING SUPABASE CREDENTIALS:");
  if (!supabaseUrl) console.error("   - SUPABASE_URL is undefined");
  if (!supabaseKey) console.error("   - SUPABASE_SECRET_KEY is undefined");
  console.error("Check your Railway dashboard 'Variables' tab.");
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseKey || ""
);

module.exports = supabase;
