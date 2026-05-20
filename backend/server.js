require("dotenv").config();
const express = require("express");
const cors = require("cors");

const clientsRoutes = require("./routes/clients");
const projectsRoutes = require("./routes/projects");
const podsRoutes = require("./routes/pods");
const uploadsRoutes = require("./routes/uploads");
const valueStreamsRoutes = require("./routes/value_streams");
const issuesRoutes = require("./routes/issues");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

app.use("/api/clients", clientsRoutes);
app.use("/api/clients", projectsRoutes);
app.use("/api/clients", podsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/value_streams", valueStreamsRoutes);
app.use("/api/issues", issuesRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
