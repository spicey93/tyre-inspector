// importTyres.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { parse } from "csv-parse";
import Tyre from "../models/tyre.model.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/tyre-inspector";
const CSV_PATH = process.argv[2] || "/Users/deanspicer/Documents/tyre-inspector/seed/tyres.csv";
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 1000;

async function run() {
  await mongoose.connect(DB_URL, { autoIndex: true });
  console.log("Connected to MongoDB");

  const fileStream = fs.createReadStream(path.resolve(CSV_PATH), { encoding: "utf8" });
  const parser = parse({
    columns: false,
    relax_quotes: true,
    trim: true,
    skip_empty_lines: true,
  });

  let line = 0;
  let ops = [];
  let totalUpserted = 0;
  let totalModified = 0;
  let skipped = 0;

  const flush = async () => {
    if (ops.length === 0) return;
    try {
      const res = await Tyre.bulkWrite(ops, { ordered: false });
      totalUpserted += res.upsertedCount || 0;
      totalModified += res.modifiedCount || 0;
    } catch (err) {
      console.error(
        "Bulk error:",
        err?.writeErrors?.length ? `${err.writeErrors.length} writeErrors` : err.message
      );
    } finally {
      ops = [];
    }
  };

  fileStream.pipe(parser);

  for await (const record of parser) {
    line += 1;

    // Skip header if present
    if (line === 1 && record[0]?.toLowerCase() === "brand" && record[1]?.toLowerCase() === "model") {
      continue;
    }

    const rawBrand = (record[0] || "").trim();
    const rawModel = (record[1] || "").trim();

    if (!rawBrand || !rawModel) {
      skipped += 1;
      continue;
    }

    // Optional light normalisation to reduce near-duplicates
    const brand = rawBrand;
    const model = rawModel.replace(/\s+/g, " ").replace(/\u2013|\u2014/g, "-").trim();

    ops.push({
      updateOne: {
        filter: { brand },
        update: {
          $setOnInsert: { brand },
          $addToSet: { models: model },
        },
        upsert: true,
      },
    });

    if (ops.length >= BATCH_SIZE) {
      await flush();
      process.stdout.write(`Processed ~${line} lines... (upserted: ${totalUpserted}, modified: ${totalModified})\r`);
    }
  }

  await flush();

  console.log(
    `\nDone. Lines: ${line}. Upserted docs: ${totalUpserted}. Modified docs: ${totalModified}. Skipped lines: ${skipped}.`
  );

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(async (e) => {
  console.error("Fatal error:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
