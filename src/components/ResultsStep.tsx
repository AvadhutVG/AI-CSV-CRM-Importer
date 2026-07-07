/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, XCircle, Download, RefreshCw, Layers, AlertCircle, FileSpreadsheet } from "lucide-react";
import { motion } from "motion/react";
import Papa from "papaparse";
import { APIResponse, CRMRecord, SkippedRecord } from "../types.js";

interface ResultsStepProps {
  response: APIResponse;
  onReset: () => void;
}

export default function ResultsStep({ response, onReset }: ResultsStepProps) {
  const [activeTab, setActiveTab] = useState<"success" | "skipped">("success");
  const { records, skipped, totalImported, totalSkipped, isFallback } = response;

  const totalProcessed = totalImported + totalSkipped;
  const successRate = totalProcessed > 0 ? Math.round((totalImported / totalProcessed) * 100) : 0;

  const downloadCSV = () => {
    if (records.length === 0) return;

    const csvText = Papa.unparse(records);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `groweasy_mapped_leads_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Array<keyof CRMRecord> = [
    "created_at",
    "name",
    "email",
    "country_code",
    "mobile_without_country_code",
    "company",
    "city",
    "state",
    "country",
    "lead_owner",
    "crm_status",
    "crm_note",
    "data_source",
    "possession_time",
    "description",
  ];

  return (
    <motion.div
      id="results-step-container"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {isFallback && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex gap-3 text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold">⚠️ Local Heuristic Fallback Mapping Activated</h4>
            <p className="leading-relaxed opacity-90">
              The external AI services are currently unconfigured or returned an authentication error (invalid API keys). GrowEasy has seamlessly activated its high-precision local regex & semantic heuristic mapping engine to process your leads.
            </p>
            <p className="font-semibold mt-1">
              To resolve this: configure a valid <strong>GEMINI_API_KEY</strong> in your Secrets Panel.
            </p>
          </div>
        </div>
      )}

      {/* Header Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Total Mapped
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {totalImported}
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Total Skipped
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {totalSkipped}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Success Rate
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
              {successRate}%
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col justify-center space-y-2">
          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              disabled={records.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white rounded-xl text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Clean CSV
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition"
              title="Import another file"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 gap-6">
        <button
          onClick={() => setActiveTab("success")}
          className={`pb-4 text-sm font-semibold relative transition ${
            activeTab === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          Successfully Parsed Records ({records.length})
          {activeTab === "success" && (
            <motion.div
              layoutId="activeTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab("skipped")}
          className={`pb-4 text-sm font-semibold relative transition ${
            activeTab === "skipped"
              ? "text-red-600 dark:text-red-400"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          Skipped Records ({skipped.length})
          {activeTab === "skipped" && (
            <motion.div
              layoutId="activeTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 dark:bg-red-400"
            />
          )}
        </button>
      </div>

      {/* Tables container */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        {activeTab === "success" ? (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-12 text-center">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap min-w-[150px]"
                    >
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No records were successfully processed.
                    </td>
                  </tr>
                ) : (
                  records.map((record, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 even:bg-gray-50/20 dark:even:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500 text-center border-r border-gray-100 dark:border-gray-800">
                        {idx + 1}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[250px] truncate"
                          title={String(record[col] || "")}
                        >
                          {record[col] !== null && record[col] !== undefined ? String(record[col]) : ""}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-12 text-center">
                    #
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider whitespace-nowrap min-w-[250px]">
                    Reason for Skipping
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Original Row Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {skipped.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No rows were skipped during import.
                    </td>
                  </tr>
                ) : (
                  skipped.map((skip, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-red-50/10 dark:hover:bg-red-950/5 even:bg-gray-50/20 dark:even:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500 text-center border-r border-gray-100 dark:border-gray-800">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-red-600 dark:text-red-400 flex items-start gap-2 max-w-[300px]">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{skip.reason}</span>
                      </td>
                      <td className="px-6 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 max-w-lg truncate">
                        <code>{JSON.stringify(skip.originalRow)}</code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" />
          Map Another Spreadsheet
        </button>
      </div>
    </motion.div>
  );
}
