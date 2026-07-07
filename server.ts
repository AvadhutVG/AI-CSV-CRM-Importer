/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { CSVService } from "./server/services/csvService.js";
import { processCSVRowsInBatches } from "./server/services/aiExtractionService.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limits for larger CSV files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- API ROUTES ---

/**
 * Health check endpoint.
 */
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * Standard POST endpoint: processes the CSV completely and returns the final JSON.
 */
app.post("/api/csv/import", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let rows: Array<Record<string, any>> = [];

    // Accept raw CSV text or pre-parsed JSON rows
    if (req.headers["content-type"] === "text/csv" || typeof req.body === "string") {
      const csvText = typeof req.body === "string" ? req.body : req.body.toString();
      rows = CSVService.parseCSVText(csvText);
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    } else if (req.body && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else {
      res.status(400).json({
        success: false,
        error: "Invalid request payload. Must be a JSON array of rows, a 'rows' field containing an array, or raw CSV text.",
      });
      return;
    }

    const normalized = CSVService.normalizeRows(rows);
    if (normalized.length === 0) {
      res.status(400).json({
        success: false,
        error: "The provided CSV or rows contain no readable data.",
      });
      return;
    }

    const batchSize = Number(process.env.BATCH_SIZE) || 15;
    const result = await processCSVRowsInBatches(normalized, batchSize);

    res.json({
      success: true,
      totalImported: result.records.length,
      totalSkipped: result.skipped.length,
      records: result.records,
      skipped: result.skipped,
      isFallback: result.isFallback,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Advanced SSE Streaming POST endpoint: streams progress updates during AI mapping
 * and finishes with the final result. Highly interactive!
 */
app.post("/api/csv/import-stream", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let rows: Array<Record<string, any>> = [];

    if (Array.isArray(req.body)) {
      rows = req.body;
    } else if (req.body && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else if (typeof req.body === "string") {
      rows = CSVService.parseCSVText(req.body);
    } else {
      res.status(400).json({
        success: false,
        error: "Invalid request. Body must be a JSON array of rows.",
      });
      return;
    }

    const normalized = CSVService.normalizeRows(rows);
    if (normalized.length === 0) {
      res.status(400).json({
        success: false,
        error: "The provided CSV or rows contain no readable data.",
      });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const batchSize = Number(process.env.BATCH_SIZE) || 15;

    // Start batch processing with progress stream
    const result = await processCSVRowsInBatches(normalized, batchSize, (progress) => {
      const percentage = Math.round((progress.batchIndex / progress.totalBatches) * 100);
      sendSSE("progress", {
        currentBatch: progress.batchIndex,
        totalBatches: progress.totalBatches,
        progressPercentage: percentage,
      });
    });

    // Send complete event with full payload
    sendSSE("complete", {
      success: true,
      totalImported: result.records.length,
      totalSkipped: result.skipped.length,
      records: result.records,
      skipped: result.skipped,
      isFallback: result.isFallback,
    });

    res.end();
  } catch (error: any) {
    console.error("SSE Streaming import error:", error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || "Internal server error during import" })}\n\n`);
    res.end();
  }
});

// --- CENTRAL ERROR HANDLER ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Express Error Handler:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "An unexpected error occurred on the server.",
  });
});

// --- STATIC ASSET SERVING & VITE INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Development App available via proxy`);
  });
}

startServer();
