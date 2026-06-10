require("dotenv").config();
const express = require("express");
const routes = require("./routes");
const saveRoute = require("./routes/save");



const app = express();

app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Second Brain Running");
});
app.use("/api", routes);
app.use("/", routes);
app.use("/save", saveRoute);
app.use("/telegram", require("./routes/telegram"));


const PORT = process.env.PORT || 3000;
const searchRoute = require("./routes/search");

app.use("/search", searchRoute);

// Start background services
require("./services/reminders");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});