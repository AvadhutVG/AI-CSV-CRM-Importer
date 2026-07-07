/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini client lazily
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API environment variable is not set. Please configure it in your Secrets panel.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

/**
 * AI Service using Gemini.
 * By default, it uses Gemini since it is natively injected into the environment.
 */
export async function generateJSON(prompt: string, systemInstruction: string): Promise<string> {
  const tryWithRetry = async (fn: () => Promise<string>, name: string, retries = 3): Promise<string> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const msg = error?.message || "";
        const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("fetch failed");
        
        if (isTransient && i < retries - 1) {
          const delay = (i + 1) * 2000;
          console.log(`[${name}] Transient error (${msg}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`[${name}] Max retries reached`);
  };

  return await tryWithRetry(() => callGemini(prompt, systemInstruction), "Gemini");
}

async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const ai = getGeminiClient();
  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          records: {
            type: Type.ARRAY,
            description: "List of successfully mapped and standardized CRM records",
            items: {
              type: Type.OBJECT,
              properties: {
                originalRowIndex: {
                  type: Type.INTEGER,
                  description: "The 0-based index of this row within the submitted input array",
                },
                created_at: { type: Type.STRING, description: "Normalized Date string parseable by JS new Date()" },
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                country_code: { type: Type.STRING },
                mobile_without_country_code: { type: Type.STRING },
                company: { type: Type.STRING },
                city: { type: Type.STRING },
                state: { type: Type.STRING },
                country: { type: Type.STRING },
                lead_owner: { type: Type.STRING },
                crm_status: { type: Type.STRING, description: "Exactly one of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE, or empty string" },
                crm_note: { type: Type.STRING, description: "Catch-all for extra details, additional emails/phones, original notes" },
                data_source: { type: Type.STRING, description: "Exactly one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots, or empty string" },
                possession_time: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["originalRowIndex"],
            },
          },
          skipped: {
            type: Type.ARRAY,
            description: "List of rows that were skipped due to meeting skip criteria",
            items: {
              type: Type.OBJECT,
              properties: {
                originalRowIndex: {
                  type: Type.INTEGER,
                  description: "The 0-based index of this row within the submitted input array",
                },
                reason: {
                  type: Type.STRING,
                  description: "Reason for skipping (e.g., 'No usable email or mobile number found')",
                },
              },
              required: ["originalRowIndex", "reason"],
            },
          },
        },
        required: ["records", "skipped"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response text from Gemini API");
  }
  return text;
}
