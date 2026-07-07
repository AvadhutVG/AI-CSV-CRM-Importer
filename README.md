# GrowEasy - AI CRM Importer

GrowEasy is a production-grade, stateless CRM lead import system that leverages advanced LLMs (Gemini) to align and normalize arbitrary, unknown, and highly ambiguous spreadsheets into a fixed CRM contact schema. 

## Live Demo
[https://ai-csv-crm-importer-717796387393.asia-southeast1.run.app/](https://ai-csv-crm-importer-717796387393.asia-southeast1.run.app/)

## Overview
GrowEasy solves the challenge of messy, unpredictable data imports. Instead of forcing users to manually map spreadsheet columns to CRM fields, GrowEasy uses an AI mapping engine to semantically infer column meanings, normalize formats, and handle multiple contact details gracefully.

## Tech Stack
- **Frontend**: React 19, Tailwind CSS 4, Vite, `lucide-react`, `motion` (for animations), `papaparse` (client-side CSV parsing)
- **Backend**: Node.js, Express (with `tsx` for TypeScript execution)
- **AI**: Google Gemini API (`@google/genai`)

## Architecture Overview
The application follows a stateless architecture where the backend processes data purely in memory, ensuring user data is never persisted.
1. **Upload**: User uploads a CSV. Client-side parsing via PapaParse reads the headers and rows.
2. **Preview**: The client displays a preview of the extracted headers (no backend call yet).
3. **Confirm**: User confirms the import. The frontend sends the parsed rows as a JSON payload to the backend.
4. **Backend Processing**: The backend receives the parsed records and splits them into configurable batches.
5. **AI Extraction**: Each batch is sent to the Gemini API with a robust system prompt.
6. **Retry Logic**: If a batch fails (e.g., rate limit or transient error), exponential backoff retries the batch up to 3 times.
7. **Response**: Progress events are streamed back to the client via Server-Sent Events (SSE) while batches are processed, ending with a final complete payload mapped into successful and skipped records.

### Folder Structure
```
.
├── src/
│   ├── components/
│   │   ├── ConfirmStep.tsx
│   │   ├── PreviewStep.tsx
│   │   ├── ResultsStep.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── UploadStep.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── types.ts
├── server/
│   ├── services/
│   │   ├── aiExtractionService.ts
│   │   └── aiService.ts
├── server.ts
├── package.json
└── vite.config.ts
```

## AI Prompt Design
The core value of GrowEasy lies in the robust `SYSTEM_INSTRUCTION` passed to the Gemini model. It guarantees accurate mapping via specific rules:

- **Semantic Inference**: The prompt instructs the AI to infer meaning from content rather than relying on exact header names. E.g., it can infer that "Ph No", "Client Phone", or "Mobile" all map to the CRM's mobile phone field.
- **First-Contact Rule**: If a row contains multiple emails or phone numbers, the model extracts the first one for the primary `email` or `mobile_without_country_code` field, and appends the rest into the `crm_note` field.
- **Skip Logic**: A strict criteria ensures that any record missing both a usable email AND a usable mobile number is entirely excluded from the `records` array and placed into a `skipped` array with a descriptive reason.
- **Few-Shot Anchoring**: 4 explicit examples (Complete lead, multiple contacts, skipped lead, incomplete but mappable lead) are provided directly in the system prompt. This drastically reduces hallucination and enforces the structured JSON output format.
- **Data Normalization**: Instructions to extract country codes separately, remove formatting from phone numbers, and normalize dates into ISO-parseable formats.

## Setup Instructions

1. **Clone the repository** (or download the source).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   Create a `.env` file based on `.env.example`:

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Required to access Google's Gemini API. Get one at [aistudio.google.com](https://aistudio.google.com). | `AIzaSy...` |
| `BATCH_SIZE` | Number of rows sent per LLM prompt to optimize throughput. | `15` |
| `GEMINI_MODEL_NAME` | The specific Gemini model to use. | `gemini-2.5-flash` |
| `APP_URL` | Application URL (usually auto-injected by the environment). | `http://localhost:3000` |

4. **Run Locally**:
   ```bash
   npm run dev
   ```
   The dev server will boot up and handle both the Vite frontend and Express backend.

## API Documentation

### `POST /api/csv/import-stream`
Processes an uploaded CSV file using LLM batch mapping with Server-Sent Events (SSE) streaming.
- **Content-Type**: `application/json`
- **Body**: Array of JSON objects representing the parsed CSV rows.
- **Response**: `text/event-stream` (Server-Sent Events)

**Events Streamed:**

1. `progress`
Sent incrementally as each batch is processed.
```json
{
  "currentBatch": 1,
  "totalBatches": 3,
  "progressPercentage": 33
}
```

2. `complete`
Sent at the end with the fully processed result.
```json
{
  "success": true,
  "totalImported": 10,
  "totalSkipped": 1,
  "records": [
    {
      "originalRowIndex": 1,
      "name": "Alice Smith",
      "email": "alice@example.com"
      // ... CRM properties
    }
  ],
  "skipped": [
    {
      "originalRow": {
        "Full Name": "Charlie Green",
        "City": "Seattle"
      },
      "reason": "No usable email or mobile number found"
    }
  ],
  "isFallback": false
}
```

3. `error`
Sent if a fatal error occurs.
```json
{
  "message": "Internal server error during import"
}
```

## CRM Field Schema
| Field | Type | Description |
|---|---|---|
| `created_at` | String | Normalized Date string parseable by JS `new Date()` |
| `name` | String | Full name of the lead |
| `email` | String | Primary email address |
| `country_code` | String | Phone country code (e.g. `+1`) |
| `mobile_without_country_code` | String | Cleaned mobile number without country code |
| `company` | String | Company name |
| `city` | String | City name |
| `state` | String | State or province name |
| `country` | String | Country name |
| `lead_owner` | String | Assigned agent or owner |
| `crm_status` | String | E.g., `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT` |
| `crm_note` | String | Catch-all for extra details, additional contact info |
| `data_source` | String | Identifiable source campaign (e.g., `meridian_tower`) |
| `possession_time` | String | Timeline or possession schedule |
| `description` | String | Detailed description |

## Bonus Features Implemented
- **Drag and Drop**: Fully supported in the upload UI.
- **Animated UI**: Elegant step transitions and micro-interactions using `motion/react`.
- **Progress Indicators**: Real-time progress updates during CSV import in the UI.
- **Dark Mode**: Fully implemented and togglable via `ThemeToggle.tsx`.
- **Retry Logic**: Exponential backoff implemented on the backend to handle transient AI provider errors.
- **Stateless Architecture**: Zero databases. Everything is processed purely in memory for ultimate security and privacy.

## Known Limitations / Future Improvements
- Very large CSVs (e.g., 1000+ rows) may take considerable time to process sequentially in batches and could hit server timeout limits. A future improvement would involve queuing processing asynchronously and notifying the user.
- The system prompt maps specific enums (e.g., `data_source`, `crm_status`). Adding dynamic support for user-defined CRM configurations via the frontend would require injecting the schema dynamically into the system prompt.

## Testing
The application has been tested with various edge cases:
- **Clean Data**: Standard straightforward headers map perfectly.
- **Relabeled Headers**: Obscure names like "Contact Person", "Details", "Number" successfully map to the correct semantic fields.
- **Multiple Contacts**: Rows with two emails correctly split the first to `email` and append the second to `crm_note`.
- **Incomplete Garbage Rows**: Rows containing only a name or empty columns are properly identified and moved to the `skipped` array.
