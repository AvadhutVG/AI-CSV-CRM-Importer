/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface UploadStepProps {
  onFileLoaded: (file: File, csvText: string) => void;
}

export default function UploadStep({ onFileLoaded }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please select a valid CSV file (.csv).");
      return;
    }

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setIsLoading(false);
      onFileLoaded(file, text);
    };
    reader.onerror = () => {
      setIsLoading(false);
      setError("Failed to read the file. Please try again.");
    };

    // Simulate short progress for highly premium tactile feel
    setTimeout(() => {
      reader.readAsText(file);
    }, 600);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      id="upload-step-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          Upload Your Lead Spreadsheet
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload any CSV from Facebook, Google, manual sheets, or CRMs. GrowEasy will intelligently auto-map all your ambiguous column fields.
        </p>
      </div>

      <div
        id="drag-and-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[300px] ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-gray-300 dark:border-gray-700 hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-800/40"
        }`}
      >
        <input
          id="csv-file-input"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv"
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse">
              Reading and parsing CSV file...
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform duration-200">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-base font-medium text-gray-800 dark:text-gray-200 mb-1">
              Drag & drop your CSV file here, or <span className="text-emerald-600 dark:text-emerald-400 hover:underline">browse</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Supports standard .csv file formats up to 50MB
            </p>
          </>
        )}
      </div>

      {error && (
        <motion.div
          id="upload-error-banner"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Invalid File</h4>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Mini tip section */}
      <div className="mt-8 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex gap-3">
        <FileSpreadsheet className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          <strong>Tip:</strong> Don't worry about matching column names like "First Name" or "Contact Email" to the CRM exactly. Our AI-powered field alignment agent reads the headers AND row content to map them perfectly.
        </p>
      </div>
    </motion.div>
  );
}
