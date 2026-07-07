/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Table, Eye, ChevronRight, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface PreviewStepProps {
  csvText: string;
  fileName: string;
  onBack: () => void;
  onConfirm: (parsedData: Array<Record<string, any>>) => void;
}

export default function PreviewStep({ csvText, fileName, onBack, onConfirm }: PreviewStepProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);

  useEffect(() => {
    if (!csvText) return;

    try {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn("Local PapaParse parsed with errors:", results.errors);
          }

          if (results.meta && results.meta.fields) {
            setHeaders(results.meta.fields);
          } else if (results.data && results.data.length > 0) {
            // Fallback if header detection missed
            setHeaders(Object.keys(results.data[0]));
          }

          setRows(results.data as Array<Record<string, any>>);
        },
        error: (err) => {
          setParsingError(`Failed to parse CSV: ${err.message}`);
        },
      });
    } catch (e: any) {
      setParsingError(`Unexpected parsing error: ${e.message}`);
    }
  }, [csvText]);

  if (parsingError) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Parsing Failed</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-6">{parsingError}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium transition"
        >
          Try Another File
        </button>
      </div>
    );
  }

  return (
    <motion.div
      id="preview-step-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1">
            <Eye className="w-3.5 h-3.5" />
            Step 2: Raw CSV Preview
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            {fileName}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">CSV Stats</div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {rows.length} rows &bull; {headers.length} columns
            </div>
          </div>
        </div>
      </div>

      {/* Row / Column Stats bar */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
        <strong>In-browser verification complete:</strong> We found {headers.length} unique headers. No records have been processed by AI yet. Click "Next" to configure mapping options and start importing.
      </div>

      {/* Responsive Table Container */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm max-h-[450px] flex flex-col">
        <div className="overflow-auto flex-1 relative scrollbar-thin">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-12 text-center">
                  #
                </th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap min-w-[150px]"
                  >
                    {header || "(Unnamed Column)"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No rows found in this CSV.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 even:bg-gray-50/20 dark:even:bg-gray-900/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500 text-center border-r border-gray-100 dark:border-gray-800">
                      {rowIndex + 1}
                    </td>
                    {headers.map((header) => {
                      const cellValue = row[header];
                      return (
                        <td
                          key={header}
                          className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[300px] truncate whitespace-nowrap"
                          title={String(cellValue ?? "")}
                        >
                          {cellValue !== null && cellValue !== undefined ? String(cellValue) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Button footer */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Choose Different File
        </button>

        <button
          onClick={() => onConfirm(rows)}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/10"
        >
          Next: Confirm & Map
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
