const express = require("express");
const app = express();

app.use(express.json()); // lets the server understand JSON data sent to it

app.get("/", (req, res) => {
  res.send("HelpDesk backend is running!");
});

const ticketRoutes = require("./routes/tickets");
app.use("/tickets", ticketRoutes);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});