/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CRMStatus {
  GOOD_LEAD_FOLLOW_UP = "GOOD_LEAD_FOLLOW_UP",
  DID_NOT_CONNECT = "DID_NOT_CONNECT",
  BAD_LEAD = "BAD_LEAD",
  SALE_DONE = "SALE_DONE",
  EMPTY = ""
}

export enum CRMDataSource {
  LEADS_ON_DEMAND = "leads_on_demand",
  MERIDIAN_TOWER = "meridian_tower",
  EDEN_PARK = "eden_park",
  VARAH_SWAMY = "varah_swamy",
  SARJAPUR_PLOTS = "sarjapur_plots",
  EMPTY = ""
}

export interface CRMRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CRMStatus | string;
  crm_note: string;
  data_source: CRMDataSource | string;
  possession_time: string;
  description: string;
}

export interface SkippedRecord {
  originalRow: Record<string, any>;
  reason: string;
}

export interface APIResponse {
  success: boolean;
  totalImported: number;
  totalSkipped: number;
  records: CRMRecord[];
  skipped: SkippedRecord[];
  isFallback?: boolean;
  fallbackReason?: string;
}

export interface ImportBatchProgress {
  totalBatches: number;
  currentBatch: number;
  progressPercentage: number;
}
