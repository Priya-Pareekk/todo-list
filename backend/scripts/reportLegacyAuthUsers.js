require("dotenv").config();
const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/db");
const User = require("../src/models/User");

/**
 * Read-only diagnostic report for legacy auth records.
 * Shows users with authProvider=local and missing password hash.
 */
async function run() {
  await connectDatabase();

  const query = {
    authProvider: "local",
    $or: [{ password: null }, { password: { $exists: false } }]
  };

  const count = await User.countDocuments(query);
  const sample = await User.find(query)
    .select("email authProvider password createdAt")
    .limit(5)
    .lean();

  console.log("Legacy local users missing password:", count);
  console.log("Sample records:", sample);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Report failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // no-op
  }
  process.exit(1);
});
