require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/db");
const User = require("../src/models/User");

/**
 * One-time migration script.
 * Purpose: fix legacy local users created without password by assigning a password hash.
 * Usage:
 *   node scripts/fixLegacyLocalUsers.js --email=user@example.com --password=StrongPass123!
 */
async function run() {
  const args = process.argv.slice(2);
  const emailArg = args.find((item) => item.startsWith("--email="));
  const passwordArg = args.find((item) => item.startsWith("--password="));

  if (!emailArg || !passwordArg) {
    console.error("Missing arguments. Use --email and --password.");
    process.exit(1);
  }

  const email = emailArg.replace("--email=", "").trim().toLowerCase();
  const password = passwordArg.replace("--password=", "");

  if (!email || !password) {
    console.error("email and password cannot be empty.");
    process.exit(1);
  }

  await connectDatabase();

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    console.error("User not found for email:", email);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user.authProvider !== "local") {
    console.error("User is not a local account. Refusing to set password for oauth account.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  user.password = hash;
  await user.save();

  console.log("Legacy local user fixed successfully:", {
    userId: String(user._id),
    email: user.email,
    authProvider: user.authProvider
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // no-op
  }
  process.exit(1);
});
