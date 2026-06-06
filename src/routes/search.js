const express = require("express");
const router = express.Router();

const supabase = require("../services/supabase");

router.get("/", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.status(400).json({
        error: "Query required"
      });
    }

    const { data, error } = await supabase
      .from("items")
      .select("content,tag,type,created_at")
      .ilike("content", `%${q}%`)
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;