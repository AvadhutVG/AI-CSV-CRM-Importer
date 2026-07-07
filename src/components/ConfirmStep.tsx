/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Play, ArrowLeft, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { APIResponse, ImportBatchProgress } from "../types.js";

interface ConfirmStepProps {
  rows: Array<Record<string, any>>;
  onBack: () => void;
  onImportComplete: (response: APIResponse) => void;
}

export default function ConfirmStep({ rows, onBack, onImportComplete }: ConfirmStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportBatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");

  const startImport = async () => {
    setIsProcessing(true);
    setError(null);
    setProgress({ totalBatches: 0, currentBatch: 0, progressPercentage: 0 });
    setStatusText("Initializing AI schema alignment agents...");

    try {
      const response = await fetch("/api/csv/import-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rows),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = "Failed to start AI extraction.";
        try {
          const parsedErr = JSON.parse(errorText);
          errMsg = parsedErr.error || errMsg;
        } catch {
          errMsg = errorText || errMsg;
        }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let completeResponse: APIResponse | null = null;
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.replace("event:", "").trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.replace("data:", "").trim();
            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === "progress") {
                setProgress(data);
                setStatusText(
                  `Mapping records in batch ${data.currentBatch} of ${data.totalBatches}...`
                );
              } else if (currentEvent === "complete") {
                completeResponse = data;
              } else if (currentEvent === "error") {
                throw new Error(data.message || "An error occurred during background processing.");
              }
            } catch (err: any) {
              console.error("Error parsing event stream data:", err, dataStr);
              if (currentEvent === "error") {
                throw new Error(err.message || "AI Extraction error.");
              }
            }
          }
        }
      }

      if (completeResponse) {
        onImportComplete(completeResponse);
      } else {
        throw new Error("Import completed but did not receive structured records.");
      }
    } catch (err: any) {
      console.error("Import processing failed:", err);
      setError(err.message || "Network error. Failed to complete import.");
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      id="confirm-step-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-xl mx-auto text-center"
    >
      {!isProcessing ? (
        <>
          <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Ready to Run AI Alignment
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            You've parsed <strong>{rows.length} rows</strong>. On confirmation, GrowEasy will automatically partition these rows into optimal token-safe batches, identify and normalize fields, and map them to our system schema in real-time.
          </p>

          {/* AI Settings box */}
          <div className="mb-8 p-5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 text-left space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase">
              Alignment Parameters
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium text-gray-400 dark:text-gray-500">Mapping Model</div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 mt-0.5">Gemini 3.5 Flash</div>
              </div>
              <div>
                <div className="font-medium text-gray-400 dark:text-gray-500">Batch Strategy</div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 mt-0.5">15 rows per cycle</div>
              </div>
              <div>
                <div className="font-medium text-gray-400 dark:text-gray-500">Validation Mode</div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 mt-0.5">Strict (Email or Phone)</div>
              </div>
              <div>
                <div className="font-medium text-gray-400 dark:text-gray-500">Retry Protocol</div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 mt-0.5">2 Retries with Backoff</div>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              id="confirm-error-banner"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-left flex gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Extraction Error</h4>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-between items-center pt-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              View Raw Preview
            </button>

            <button
              onClick={startImport}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/10"
            >
              <Play className="w-4 h-4" />
              Confirm & Start Mapping
            </button>
          </div>
        </>
      ) : (
        <div className="py-12">
          <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin"></div>
            <Sparkles className="w-8 h-8 text-emerald-500 animate-pulse" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            AI Field Mapping in Progress
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8 animate-pulse">
            {statusText}
          </p>

          {progress && progress.totalBatches > 0 && (
            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 font-medium">
                <span>Batch {progress.currentBatch} of {progress.totalBatches}</span>
                <span>{progress.progressPercentage}% Complete</span>
              </div>
              <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progressPercentage}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Stateless in-memory processing. Your keys and logs remain private.
          </div>
        </div>
      )}
    </motion.div>
  );
}
