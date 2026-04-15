const app = require("../backend/src/app");
const { connectDatabase } = require("../backend/src/config/db");

module.exports = async (req, res) => {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error("[vercel] API bootstrap failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server configuration error. Check environment variables and database connectivity."
    });
  }
};
