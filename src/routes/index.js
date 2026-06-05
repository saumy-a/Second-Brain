const express = require("express");
const router = express.Router();
const testRouter = require("./test");

router.get("/status", (req, res) => {
  res.json({ status: "OK", message: "API is working" });
});

router.use("/test", testRouter);

module.exports = router;
