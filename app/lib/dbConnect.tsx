import mongoose from "mongoose";
import { attachDatabasePool } from "@vercel/functions";

const MONGODB_URI = process.env.DB_URI_MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

// Global cache (for hot reload & lambda reuse)
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalWithCache = global as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalWithCache.mongooseCache || {
  conn: null,
  promise: null,
};

if (!globalWithCache.mongooseCache) {
  globalWithCache.mongooseCache = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Keep connections open between taps: reconnecting to Atlas costs ~1.5s, and with 5s
      // nearly every action in a quiet studio paid it. attachDatabasePool still lets Vercel
      // drain idle connections before suspending the function. Override with DB_MAX_IDLE_MS.
      maxIdleTimeMS: Number(process.env.DB_MAX_IDLE_MS) || 60_000,
      dbName: process.env.DB_NAME || "QuickShine", // 🔥 explicitly setting DB here (DB_NAME overrides, e.g. for a test database)
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      attachDatabasePool(mongoose.connection.getClient());
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;