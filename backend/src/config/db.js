const mongoose = require("mongoose");

const globalWithDbCache = global;
if (!globalWithDbCache.__pulsetasksDbCache) {
  globalWithDbCache.__pulsetasksDbCache = {
    conn: null,
    promise: null,
    listenersBound: false
  };
}

const dbCache = globalWithDbCache.__pulsetasksDbCache;

const DB_STATE_LABELS = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

const validateMongoUri = (uri) => {
  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add it in backend/.env.");
  }

  const trimmedUri = uri.trim();
  const hasValidPrefix = trimmedUri.startsWith("mongodb://") || trimmedUri.startsWith("mongodb+srv://");
  if (!hasValidPrefix) {
    throw new Error(
      "Invalid MONGODB_URI format. It must start with mongodb:// or mongodb+srv://"
    );
  }

  const protocolSplit = trimmedUri.split("://");
  const authorityAndPath = protocolSplit[1] || "";
  const authority = authorityAndPath.split("/")[0] || "";
  const atCount = (authority.match(/@/g) || []).length;

  if (atCount > 1) {
    throw new Error(
      "MONGODB_URI likely has an unencoded '@' in username/password. URL-encode it as %40."
    );
  }

  return trimmedUri;
};

const getDbState = () => {
  const stateCode = mongoose.connection.readyState;
  return {
    code: stateCode,
    label: DB_STATE_LABELS[stateCode] || "unknown"
  };
};

const getSanitizedUriForLogs = (uri) => {
  // Hide credentials but keep host/db for quick debugging.
  return uri.replace(/:\/\/.*@/, "://<credentials-hidden>@");
};

const connectDatabase = async () => {
  if (dbCache.conn) {
    return dbCache.conn;
  }

  const rawUri = process.env.MONGODB_URI;
  const MONGODB_URI = validateMongoUri(rawUri);

  if (!dbCache.listenersBound) {
    mongoose.connection.on("connected", () => {
      console.log("[db] Mongoose connected");
    });

    mongoose.connection.on("disconnected", () => {
      console.log("[db] Mongoose disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("[db] Mongoose connection error:", err.message);
    });

    dbCache.listenersBound = true;
  }

  if (!dbCache.promise) {
    console.log("[db] Connection attempt started");
    console.log(`[db] URI: ${getSanitizedUriForLogs(MONGODB_URI)}`);

    dbCache.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10
      })
      .then(async () => {
        await mongoose.connection.db.admin().ping();
        const currentState = getDbState();
        console.log(`[db] Ping success. State: ${currentState.label}`);
        return mongoose.connection;
      })
      .catch((error) => {
        dbCache.promise = null;
        throw error;
      });
  }

  dbCache.conn = await dbCache.promise;
  return dbCache.conn;
};

module.exports = {
  connectDatabase,
  getDbState,
  validateMongoUri
};
