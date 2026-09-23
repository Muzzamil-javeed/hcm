import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let memoryServer;

export async function connectDb(uri) {
  mongoose.set("strictQuery", true);
  const useEmbedded = process.env.USE_EMBEDDED_MONGO === "true";

  if (!useEmbedded && uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
      console.log("MongoDB connected");
      return;
    } catch (err) {
      console.log("Local MongoDB not running. Starting embedded MongoDB...");
    }
  }

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const dbPath = path.resolve(__dirname, "../../data/mongo");
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: "flowhcm",
      dbPath,
      storageEngine: "wiredTiger",
    },
  });
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.log("Embedded MongoDB connected");
}
