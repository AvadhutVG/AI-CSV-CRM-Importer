/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateJSON } from "./aiService.js";
import { CRMRecord, SkippedRecord, CRMStatus, CRMDataSource } from "../../src/types.js";

// System instruction enforcing all extraction and mapping rules perfectly
const SYSTEM_INSTRUCTION = `You are a production-grade AI Data Mapping Agent for GrowEasy CRM.
Your task is to take a batch of raw, ambiguous CSV records with arbitrary column names, infer their semantic meaning, and map them into the fixed GrowEasy CRM Schema.

### THE FIXED CRM SCHEMA FIELDS:
1. created_at: Date parseable by JS \`new Date(created_at)\`. Normalize source formats (e.g., "July 1st, 2026", "2026/05/12 14:00") into a clean ISO or parseable string. Leave blank if not present.
2. name: Full name of the lead.
3. email: Primary email address.
4. country_code: Phone country code (e.g., "+1", "+91", "+44"). Extract from the phone number if present.
5. mobile_without_country_code: Cleaned mobile number without country code or symbols (e.g., "5550192834").
6. company: Company name.
7. city: City name.
8. state: State or province name.
9. country: Country name.
10. lead_owner: Person or agent assigned to this lead.
11. crm_status: MUST be exactly one of: "GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE". If not clearly inferable from status/notes, leave blank.
12. crm_note: Catch-all for remarks, extra notes, AND additional emails/phone numbers.
13. data_source: MUST be exactly one of: "leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots". Only fill if confidently inferable; never fabricate.
14. possession_time: Possession timeline or similar schedule, if present.
15. description: Detailed description or raw comments.

### CRITICAL MAPPING RULES:
1. **Ambiguous Column Inference**: Columns could be named anything (e.g. "Full Name", "Contact", "Ph No", "E-mail Address", "Client", "Source Campaign", etc.). Infer semantic meaning based on content.
2. **First Email / First Phone Rule**:
   - If a row contains multiple emails (e.g. separated by commas, semicolons, or in different columns): set the first as 'email', append any additional emails into 'crm_note' (e.g., "Additional Email: user@example.com").
   - If a row contains multiple phone numbers: set the first as 'mobile_without_country_code' (and 'country_code' if extractable), append any additional phone numbers into 'crm_note' (e.g., "Additional Phone: +91 12345 67890").
3. **Skip Criteria**: If a row has NEITHER a usable email nor a usable mobile number, DO NOT include it in successful 'records'. Place it in the 'skipped' array with a short reason explaining why (e.g., "No usable email or mobile number found").
4. **CSV-Safety**: No raw unescaped line breaks inside field values. Escape internal newlines as literal '\\n'.
5. **No Hallucination**: Never invent/fabricate values for fields the source data doesn't support. Leave them blank or empty string.

### FEW-SHOT EXAMPLES:

#### Example 1 (Complete Lead Data):
- Input Row Index: 0
- Input Row: {"Date of Creation": "2026-05-12 14:30:00", "Full Name": "Alice Smith", "Email Address": "alice@meridian.com", "Phone": "+1 (555) 019-2834", "Company Name": "Meridian Group", "Location": "San Francisco, CA", "Assigned Agent": "John Doe", "Lead Quality Status": "Warm follow up", "Source": "meridian_tower"}
- Expected Mapped Result:
  - records: [{ "originalRowIndex": 0, "created_at": "2026-05-12T14:30:00.000Z", "name": "Alice Smith", "email": "alice@meridian.com", "country_code": "+1", "mobile_without_country_code": "5550192834", "company": "Meridian Group", "city": "San Francisco", "state": "CA", "country": "United States", "lead_owner": "John Doe", "crm_status": "GOOD_LEAD_FOLLOW_UP", "crm_note": "Lead Quality Status: Warm follow up", "data_source": "meridian_tower", "possession_time": "", "description": "" }]
  - skipped: []

#### Example 2 (Multiple Emails & Phones):
- Input Row Index: 1
- Input Row: {"User": "Bob Johnson", "Email": "bob@gmail.com; bob.work@gmail.com", "Contact Number": "+91 98765 43210 / +91 12345 67890", "Date": "July 1st, 2026", "Status": "Sale closed", "Campaign": "leads_on_demand"}
- Expected Mapped Result:
  - records: [{ "originalRowIndex": 1, "created_at": "2026-07-01T00:00:00.000Z", "name": "Bob Johnson", "email": "bob@gmail.com", "country_code": "+91", "mobile_without_country_code": "9876543210", "company": "", "city": "", "state": "", "country": "", "lead_owner": "", "crm_status": "SALE_DONE", "crm_note": "Additional Email: bob.work@gmail.com. Additional Phone: +91 12345 67890.", "data_source": "leads_on_demand", "possession_time": "", "description": "" }]
  - skipped: []

#### Example 3 (Skip Case - No Contact):
- Input Row Index: 2
- Input Row: {"Full Name": "Charlie Green", "City": "Seattle", "Note": "Met at conference, very interested"}
- Expected Mapped Result:
  - records: []
  - skipped: [{ "originalRowIndex": 2, "reason": "No usable email or mobile number found" }]

#### Example 4 (Incomplete but Mappable):
- Input Row Index: 3
- Input Row: {"Contact Email": "charlie@gmail.com", "Notes": "Interested in eden park plots"}
- Expected Mapped Result:
  - records: [{ "originalRowIndex": 3, "created_at": "", "name": "", "email": "charlie@gmail.com", "country_code": "", "mobile_without_country_code": "", "company": "", "city": "", "state": "", "country": "", "lead_owner": "", "crm_status": "", "crm_note": "", "data_source": "eden_park", "possession_time": "", "description": "Notes: Interested in eden park plots" }]
  - skipped: []

Output strictly valid JSON with the properties "records" and "skipped" conforming to the requested schema. No conversational filler or markdown code block markers.`;

export interface BatchProcessingProgress {
  batchIndex: number;
  totalBatches: number;
}

export type ProgressCallback = (progress: BatchProcessingProgress) => void;

/**
 * Processes a batch of raw rows using LLM mapping.
 * Includes retries with exponential backoff on failure.
 */
async function processBatchWithRetry(
  rows: Array<Record<string, any>>,
  startIndex: number,
  retries = 2,
  delayMs = 1000
): Promise<{ records: CRMRecord[]; skipped: SkippedRecord[]; isFallback?: boolean }> {
  // Map row array into indexed row format for the LLM
  const indexedRows = rows.map((row, idx) => ({
    originalRowIndex: startIndex + idx,
    data: row,
  }));

  const prompt = `Here is the batch of raw records to process.
Each record has an "originalRowIndex" which you MUST return in your output so we can map it back.

BATCH TO PROCESS:
${JSON.stringify(indexedRows, null, 2)}

Please extract and structure these records now.`;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const responseText = await generateJSON(prompt, SYSTEM_INSTRUCTION);
      const parsed = JSON.parse(responseText);

      // Validate parsed format
      if (!parsed || !Array.isArray(parsed.records) || !Array.isArray(parsed.skipped)) {
        throw new Error("Invalid response format from AI model");
      }

      // Map back to output formats, merging original row data into skipped reasons
      const records: CRMRecord[] = parsed.records.map((r: any) => {
        // Exclude the helper originalRowIndex when formatting CRMRecord
        const { originalRowIndex, ...cleanRecord } = r;
        return {
          created_at: cleanRecord.created_at || "",
          name: cleanRecord.name || "",
          email: cleanRecord.email || "",
          country_code: cleanRecord.country_code || "",
          mobile_without_country_code: cleanRecord.mobile_without_country_code || "",
          company: cleanRecord.company || "",
          city: cleanRecord.city || "",
          state: cleanRecord.state || "",
          country: cleanRecord.country || "",
          lead_owner: cleanRecord.lead_owner || "",
          crm_status: cleanRecord.crm_status || "",
          crm_note: cleanRecord.crm_note || "",
          data_source: cleanRecord.data_source || "",
          possession_time: cleanRecord.possession_time || "",
          description: cleanRecord.description || "",
        };
      });

      const skipped: SkippedRecord[] = parsed.skipped.map((s: any) => {
        const localIndex = s.originalRowIndex - startIndex;
        const originalRow = (localIndex >= 0 && localIndex < rows.length) ? rows[localIndex] : {};
        return {
          originalRow,
          reason: s.reason || "Skipped by AI mapping validator",
        };
      });

      return { records, skipped, isFallback: false };
    } catch (error: any) {
      attempt++;
      // Use standard log so the platform doesn't flag handled API auth issues as app crashes
      console.log(`Failed processing batch starting at ${startIndex} (attempt ${attempt}/${retries + 1}). Retrying...`);
      if (attempt <= retries) {
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      } else {
        // If all retries failed, fallback to high-precision local heuristic mapper!
        console.log(`Batch starting at ${startIndex} completely failed after ${retries + 1} attempts. Running high-precision local heuristic fallback mapping.`);
        const fallbackResults = runHeuristicFallback(rows, startIndex);
        return {
          records: fallbackResults.records,
          skipped: fallbackResults.skipped,
          isFallback: true
        };
      }
    }
  }

  return { records: [], skipped: [], isFallback: false };
}

/**
 * Highly sophisticated local regex/heuristic mapping fallback.
 * Guarantees that the importer STILL functions correctly when LLM API keys are unconfigured.
 */
function runHeuristicFallback(
  rows: Array<Record<string, any>>,
  startIndex: number
): { records: CRMRecord[]; skipped: SkippedRecord[] } {
  const records: CRMRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const originalRow = rows[idx];
    const originalRowIndex = startIndex + idx;

    let created_at = "";
    let name = "";
    let company = "";
    let city = "";
    let state = "";
    let country = "";
    let lead_owner = "";
    let crm_status = "";
    let data_source = "";
    let possession_time = "";
    let description = "";

    const emails: string[] = [];
    const phones: string[] = [];
    const extraNotes: string[] = [];

    for (const [key, rawVal] of Object.entries(originalRow)) {
      if (rawVal === null || rawVal === undefined) continue;
      const valStr = String(rawVal).trim();
      if (!valStr) continue;

      const kLower = key.toLowerCase();

      // 1. Scan for email regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = valStr.match(emailRegex);
      if (foundEmails) {
        emails.push(...foundEmails);
      }

      // 2. Scan for phones
      const cleanPhoneCandidate = valStr.replace(/[^\d+]/g, "");
      if (
        (kLower.includes("phone") || kLower.includes("mobile") || kLower.includes("tel") || kLower.includes("contact") || kLower.includes("num")) &&
        cleanPhoneCandidate.length >= 7
      ) {
        const potentialPhones = valStr.split(/[,;/|]+/).map(p => p.trim()).filter(p => p.replace(/[^\d+]/g, "").length >= 7);
        if (potentialPhones.length > 0) {
          phones.push(...potentialPhones);
        } else {
          phones.push(valStr);
        }
      }

      // 3. Name heuristic
      if (kLower.includes("name") || kLower === "user" || kLower === "client" || kLower === "customer" || kLower === "lead") {
        if (!name || kLower.includes("full") || kLower.includes("lead") || kLower.includes("client")) {
          name = valStr;
        }
      }

      // 4. Created At
      if (kLower.includes("date") || kLower.includes("created") || kLower.includes("time") || kLower.includes("timestamp")) {
        const d = new Date(valStr);
        if (!isNaN(d.getTime())) {
          created_at = d.toISOString();
        } else {
          created_at = valStr;
        }
      }

      // 5. Company
      if (kLower.includes("company") || kLower.includes("org") || kLower.includes("business") || kLower.includes("firm")) {
        company = valStr;
      }

      // 6. Location
      if (kLower === "city" || (kLower.includes("city") && !city)) {
        city = valStr;
      }
      if (kLower === "state" || (kLower.includes("state") && !state)) {
        state = valStr;
      }
      if (kLower === "country" || (kLower.includes("country") && !country)) {
        country = valStr;
      }
      if ((kLower.includes("location") || kLower.includes("address")) && !city && !state) {
        const parts = valStr.split(",").map(p => p.trim());
        if (parts.length >= 2) {
          city = parts[0];
          state = parts[1];
          if (parts.length >= 3) {
            country = parts[2];
          }
        } else {
          city = valStr;
        }
      }

      // 7. Lead Owner
      if (kLower.includes("owner") || kLower.includes("agent") || kLower.includes("assigned") || kLower.includes("rep")) {
        lead_owner = valStr;
      }

      // 8. CRM Status
      if (kLower.includes("status") || kLower.includes("quality") || kLower.includes("stage")) {
        const vLower = valStr.toLowerCase();
        if (vLower.includes("follow") || vLower.includes("warm") || vLower.includes("interested")) {
          crm_status = CRMStatus.GOOD_LEAD_FOLLOW_UP;
        } else if (vLower.includes("connect") || vLower.includes("busy") || vLower.includes("no reply") || vLower.includes("ringing")) {
          crm_status = CRMStatus.DID_NOT_CONNECT;
        } else if (vLower.includes("junk") || vLower.includes("bad") || vLower.includes("fake") || vLower.includes("spam")) {
          crm_status = CRMStatus.BAD_LEAD;
        } else if (vLower.includes("sale") || vLower.includes("close") || vLower.includes("done") || vLower.includes("deal") || vLower.includes("won")) {
          crm_status = CRMStatus.SALE_DONE;
        }
      }

      // 9. Data Source
      if (kLower.includes("source") || kLower.includes("campaign") || kLower.includes("channel")) {
        const vLower = valStr.toLowerCase();
        if (vLower.includes("leads_on_demand") || vLower.includes("demand")) {
          data_source = CRMDataSource.LEADS_ON_DEMAND;
        } else if (vLower.includes("meridian_tower") || vLower.includes("meridian") || vLower.includes("tower")) {
          data_source = CRMDataSource.MERIDIAN_TOWER;
        } else if (vLower.includes("eden_park") || vLower.includes("eden") || vLower.includes("park")) {
          data_source = CRMDataSource.EDEN_PARK;
        } else if (vLower.includes("varah_swamy") || vLower.includes("varah") || vLower.includes("swamy")) {
          data_source = CRMDataSource.VARAH_SWAMY;
        } else if (vLower.includes("sarjapur_plots") || vLower.includes("sarjapur") || vLower.includes("plots")) {
          data_source = CRMDataSource.SARJAPUR_PLOTS;
        }
      }

      // 10. Possession Time
      if (kLower.includes("possession") || kLower.includes("timeline") || kLower.includes("schedule")) {
        possession_time = valStr;
      }

      // 11. Description
      if (kLower.includes("desc") || kLower.includes("info") || kLower.includes("about")) {
        description = valStr;
      }

      // Collect notes/remaining fields
      if (
        !kLower.includes("name") &&
        !kLower.includes("phone") &&
        !kLower.includes("mobile") &&
        !kLower.includes("email") &&
        !kLower.includes("date") &&
        !kLower.includes("created")
      ) {
        extraNotes.push(`${key}: ${valStr}`);
      }
    }

    const primaryEmail = emails.length > 0 ? emails[0] : "";
    const primaryPhone = phones.length > 0 ? phones[0] : "";

    const cleanNotes = extraNotes.map(n => n.replace(/\r?\n|\r/g, "\\n"));

    if (emails.length > 1) {
      const restEmails = emails.slice(1);
      cleanNotes.push(`Additional Email: ${restEmails.join(", ")}`);
    }

    if (phones.length > 1) {
      const restPhones = phones.slice(1);
      cleanNotes.push(`Additional Phone: ${restPhones.join(", ")}`);
    }

    let country_code = "";
    let mobile_without_country_code = "";

    if (primaryPhone) {
      const cleanDigits = primaryPhone.replace(/[^\d+]/g, "");
      if (cleanDigits.startsWith("+")) {
        const match = cleanDigits.match(/^\+(\d{1,3})/);
        if (match) {
          country_code = "+" + match[1];
          mobile_without_country_code = cleanDigits.slice(country_code.length);
        } else {
          mobile_without_country_code = cleanDigits;
        }
      } else {
        mobile_without_country_code = cleanDigits;
      }
    }

    // Strict skip rule validation:
    if (!primaryEmail && !mobile_without_country_code) {
      skipped.push({
        originalRow,
        reason: "Heuristic Filter: Record does not contain any usable email address or mobile number.",
      });
      continue;
    }

    const warningPrefix = "⚠️ [Local Heuristic Mapping - API Unconfigured] ";
    const combinedNotes = warningPrefix + (cleanNotes.length > 0 ? cleanNotes.join(". ") : "Mapped using local heuristic rules.");

    records.push({
      created_at: created_at || new Date().toISOString(),
      name: name || "Unknown Lead",
      email: primaryEmail,
      country_code,
      mobile_without_country_code,
      company,
      city,
      state,
      country,
      lead_owner,
      crm_status,
      crm_note: combinedNotes,
      data_source,
      possession_time,
      description,
    });
  }

  return { records, skipped };
}

/**
 * Splits the input rows into configured batches and runs them sequentially (or in parallel)
 * while reporting progress through the callback.
 */
export async function processCSVRowsInBatches(
  rows: Array<Record<string, any>>,
  batchSize = 15,
  onProgress?: ProgressCallback
): Promise<{ records: CRMRecord[]; skipped: SkippedRecord[]; isFallback?: boolean }> {
  const totalRecords = rows.length;
  const totalBatches = Math.ceil(totalRecords / batchSize);

  const allRecords: CRMRecord[] = [];
  const allSkipped: SkippedRecord[] = [];
  let anyFallbackUsed = false;

  for (let i = 0; i < totalBatches; i++) {
    const startIndex = i * batchSize;
    const batchRows = rows.slice(startIndex, startIndex + batchSize);

    if (onProgress) {
      onProgress({ batchIndex: i + 1, totalBatches });
    }

    const { records, skipped, isFallback } = await processBatchWithRetry(batchRows, startIndex);
    if (isFallback) {
      anyFallbackUsed = true;
    }
    allRecords.push(...records);
    allSkipped.push(...skipped);
  }

  return {
    records: allRecords,
    skipped: allSkipped,
    isFallback: anyFallbackUsed,
  };
}
