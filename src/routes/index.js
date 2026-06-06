const express = require("express");
const router = express.Router();
const testRouter = require("./test");

router.get("/status", (req, res) => {
  res.json({ status: "OK", message: "API is working" });
});

router.get("/health", (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    env: {
      supabase_url: !!process.env.SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_SECRET_KEY,
      telegram_token: !!process.env.TELEGRAM_TOKEN,
      gemini_key: !!process.env.GEMINI_API_KEY
    }
  };
  res.json(health);
});

router.use("/test", testRouter);

module.exports = router;
