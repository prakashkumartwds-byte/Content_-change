require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rewriteRoutes = require("./routes/rewrite");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "WebContent AI Backend Running ✅",
  });
});

app.use("/api", rewriteRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
