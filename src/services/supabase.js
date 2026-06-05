// Provide WebSocket support for Node.js versions < 22
if (typeof global.WebSocket === "undefined") {
  global.WebSocket = require("ws");
}

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = supabase;
