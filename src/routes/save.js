const express = require("express");
const router = express.Router();

const supabase = require("../services/supabase");

router.post("/", async (req, res) => {
  try {
    const {
  content,
  tag,
  type,
  source_url
} = req.body;

    if (!content) {
      return res.status(400).json({
        error: "Content is required"
      });
    }

    const { data, error } = await supabase
      .from("items")
      .insert([
{
  content,
  tag,
  type,
  source_url
}
])
      .select();

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true,
      item: data[0]
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;