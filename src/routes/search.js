const express = require("express");
const router = express.Router();
const supabase = require("../services/supabase"); // adjust path if needed

router.get("/", async (req, res) => {
  const q = req.query.q;

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .ilike("content", `%${q}%`);

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

module.exports = router;