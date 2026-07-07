/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle.tsx";
import UploadStep from "./components/UploadStep.tsx";
import PreviewStep from "./components/PreviewStep.tsx";
import ConfirmStep from "./components/ConfirmStep.tsx";
import ResultsStep from "./components/ResultsStep.tsx";
import { APIResponse } from "./types.ts";

export default function App() {
  const [step, setStep] = useState<number>(1);
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<Array<Record<string, any>>>([]);
  const [apiResponse, setApiResponse] = useState<APIResponse | null>(null);

  const handleFileLoaded = (file: File, text: string) => {
    setFileName(file.name);
    setCsvText(text);
    setStep(2);
  };

  const handleConfirmPreview = (rows: Array<Record<string, any>>) => {
    setParsedRows(rows);
    setStep(3);
  };

  const handleImportComplete = (response: APIResponse) => {
    setApiResponse(response);
    setStep(4);
  };

  const handleReset = () => {
    setStep(1);
    setCsvText("");
    setFileName("");
    setParsedRows([]);
    setApiResponse(null);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-200 font-sans text-gray-800 dark:text-gray-200">
      {/* Top Header navbar */}
      <header className="border-b border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white font-black text-lg tracking-wider shadow-lg shadow-emerald-600/10">
              GE
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-gray-900 dark:text-white leading-none">
                GrowEasy
              </h1>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest mt-1 block">
                AI CSV Importer
              </span>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Breadcrumb">
            {[
              { num: 1, label: "Upload" },
              { num: 2, label: "Preview" },
              { num: 3, label: "Confirm" },
              { num: 4, label: "Results" },
            ].map((s) => (
              <React.Fragment key={s.num}>
                <div
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    step === s.num
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : step > s.num
                      ? "text-gray-500 dark:text-gray-400"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                      step >= s.num
                        ? "border-emerald-500 dark:border-emerald-400 bg-emerald-500 text-white"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    {s.num}
                  </span>
                  {s.label}
                </div>
                {s.num < 4 && <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700" />}
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-900 rounded-3xl p-6 sm:p-10 shadow-sm">
          {step === 1 && <UploadStep onFileLoaded={handleFileLoaded} />}
          {step === 2 && (
            <PreviewStep
              csvText={csvText}
              fileName={fileName}
              onBack={handleReset}
              onConfirm={handleConfirmPreview}
            />
          )}
          {step === 3 && (
            <ConfirmStep
              rows={parsedRows}
              onBack={() => setStep(2)}
              onImportComplete={handleImportComplete}
            />
          )}
          {step === 4 && apiResponse && (
            <ResultsStep response={apiResponse} onReset={handleReset} />
          )}
        </div>
      </main>

      {/* Footnote */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-gray-100 dark:border-gray-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secured by Google AI Studio &bull; Stateless Lead Mapper</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-emerald-500 cursor-pointer">Security Protocol</span>
          <span className="hover:text-emerald-500 cursor-pointer">CRM Integrations</span>
        </div>
      </footer>
    </div>
  );
}
