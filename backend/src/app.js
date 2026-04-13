const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profileRoutes");
const taskRoutes = require("./routes/taskRoutes");
const requireUserContext = require("./middlewares/userContext");
const { getDbState } = require("./config/db");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running"
  });
});

app.get("/api/db-health", (req, res) => {
  const dbState = getDbState();

  res.json({
    success: dbState.code === 1,
    message: dbState.code === 1 ? "Database connected" : "Database not connected",
    data: {
      stateCode: dbState.code,
      state: dbState.label
    }
  });
});

app.use("/api/users", userRoutes);

// All profile and task endpoints require user context (future JWT can set req.user).
app.use("/api/profiles", requireUserContext, profileRoutes);
app.use("/api/tasks", requireUserContext, taskRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
