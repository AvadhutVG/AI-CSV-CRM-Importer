/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Papa from "papaparse";

/**
 * Service to handle any CSV processing, text parsing, or normalization.
 */
export class CSVService {
  /**
   * Parses raw CSV text into a JSON array of objects.
   * Handles column headers automatically.
   */
  public static parseCSVText(csvText: string): Array<Record<string, any>> {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });

    if (result.errors && result.errors.length > 0) {
      console.warn("CSV Parsing warning/errors:", result.errors);
    }

    return result.data as Array<Record<string, any>>;
  }

  /**
   * Normalizes incoming rows, filtering out rows that are completely empty.
   */
  public static normalizeRows(rows: Array<Record<string, any>>): Array<Record<string, any>> {
    if (!Array.isArray(rows)) {
      throw new Error("Input must be an array of records");
    }

    return rows.filter((row) => {
      if (!row || typeof row !== "object") return false;
      // Ensure at least one key has a non-empty value
      return Object.values(row).some(
        (val) => val !== null && val !== undefined && String(val).trim() !== ""
      );
    });
  }
}
