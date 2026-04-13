require("dotenv").config();
const app = require("./app");
const { connectDatabase } = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("[env] .env loaded:", {
      port: PORT,
      hasMongoUri: Boolean(process.env.MONGODB_URI)
    });

    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`DB health check: http://localhost:${PORT}/api/db-health`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process or change PORT in backend/.env.`);
      } else {
        console.error("Server listen error:", error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);

    if (/ETIMEDOUT|ENOTFOUND|ECONNREFUSED|SSL|TLS/i.test(error.message)) {
      console.error(
        "Possible causes: Atlas IP access list, wrong cluster hostname, DNS/SRV issue, firewall/proxy, or TLS interception."
      );
    }

    if (/Authentication failed|bad auth|auth/i.test(error.message)) {
      console.error(
        "Authentication issue: verify Atlas DB username/password and URL-encode special characters in password."
      );
    }

    process.exit(1);
  }
};

startServer();
