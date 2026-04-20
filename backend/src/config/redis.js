const { createClient } = require("redis");

const REDIS_ENABLED = String(process.env.REDIS_ENABLED || "true").toLowerCase() !== "false";
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";
const DEFAULT_CACHE_TTL_SECONDS = Number(process.env.REDIS_TTL_SECONDS || 300);
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000);
const REDIS_MAX_RETRIES = Number(process.env.REDIS_MAX_RETRIES || 3);

let redisClient = null;
let isRedisReady = false;

const buildRedisOptions = () => {
  const socketOptions = {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    reconnectStrategy: (retries) => {
      if (retries >= REDIS_MAX_RETRIES) {
        return new Error("Redis reconnect retry limit reached");
      }

      return Math.min((retries + 1) * 200, 1000);
    }
  };

  if (REDIS_URL) {
    return {
      url: REDIS_URL,
      socket: socketOptions
    };
  }

  return {
    socket: {
      ...socketOptions,
      host: REDIS_HOST,
      port: REDIS_PORT
    },
    password: REDIS_PASSWORD || undefined
  };
};

const connectRedis = async () => {
  if (!REDIS_ENABLED) {
    console.log("[redis] Disabled (REDIS_ENABLED=false)");
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  redisClient = createClient(buildRedisOptions());

  redisClient.on("ready", () => {
    isRedisReady = true;
    console.log("[redis] Connected");
  });

  redisClient.on("end", () => {
    isRedisReady = false;
    console.warn("[redis] Connection closed");
  });

  redisClient.on("error", (error) => {
    isRedisReady = false;
    console.error("[redis] Client error:", error.message);
  });

  try {
    console.log(
      `[redis] Connecting (${REDIS_URL ? "url" : `${REDIS_HOST}:${REDIS_PORT}`})...`
    );
    await redisClient.connect();
    console.log("[redis] Connection success");
    return redisClient;
  } catch (error) {
    console.error("[redis] Connection failure. Continuing without cache:", error.message);
    try {
      if (redisClient?.isOpen) {
        await redisClient.quit();
      }
    } catch (_closeError) {
      // Ignore cleanup failure; cache layer is optional.
    }
    redisClient = null;
    isRedisReady = false;
    return null;
  }
};

const disconnectRedis = async () => {
  if (!redisClient) {
    return;
  }

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error("[redis] Failed to close connection:", error.message);
  } finally {
    isRedisReady = false;
    redisClient = null;
  }
};

const getRedisClient = () => {
  if (!REDIS_ENABLED || !redisClient || !isRedisReady || !redisClient.isOpen) {
    return null;
  }
  return redisClient;
};

const cacheGet = async (key) => {
  const client = getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const rawValue = await client.get(key);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    console.error(`[redis] cacheGet failed for key=${key}:`, error.message);
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) => {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Math.floor(ttlSeconds)
    : DEFAULT_CACHE_TTL_SECONDS;

  try {
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error(`[redis] cacheSet failed for key=${key}:`, error.message);
  }
};

const cacheDel = async (keys) => {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  const normalizedKeys = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  if (!normalizedKeys.length) {
    return;
  }

  try {
    await client.del(normalizedKeys);
  } catch (error) {
    console.error("[redis] cacheDel failed:", error.message);
  }
};

const cacheInvalidateByPattern = async (pattern) => {
  const client = getRedisClient();
  if (!client || !pattern) {
    return;
  }

  try {
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length) {
      await client.del(keys);
    }
  } catch (error) {
    console.error(`[redis] cacheInvalidateByPattern failed for pattern=${pattern}:`, error.message);
  }
};

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheInvalidateByPattern,
  DEFAULT_CACHE_TTL_SECONDS
};