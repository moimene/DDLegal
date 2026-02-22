export interface HarveyCompletionRequest {
  prompt: string;
  model?: string;
  system_prompt?: string;
  client_matter_id?: string;
  knowledge_sources?: string[];
  file?: File | Buffer;
  metadata?: Record<string, unknown>;
}

export interface HarveyCompletionResponse {
  id: string;
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface HarveyGatewayConfig {
  endpoint: string;
  token: string;
  maxRetries: number;
  baseDelayMs: number;
  maxConcurrency: number;
  timeoutMs: number;
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'down';
  p95_latency_ms: number;
  rate_limit_429_pct: number;
  requests_last_hour: number;
  active_requests: number;
  feature_flag: 'gateway' | 'n8n' | 'shadow';
  circuit_breaker: {
    state: 'closed' | 'open' | 'half_open';
    window_requests: number;
    window_429_pct: number;
    opened_at: string | null;
  };
}

export interface GatewayTelemetry {
  request_id: string;
  endpoint: string;
  duration_ms: number;
  status_code: number;
  retries: number;
  client_matter_id?: string;
  timestamp: string;
}

// ────────────────────────────────────────────────────────────
// Harvey History / Audit Log Types
// ────────────────────────────────────────────────────────────

export interface HarveyHistoryRequest {
  start_date?: string; // ISO
  end_date?: string;   // ISO
  limit?: number;
  offset?: number;
}

export interface HarveyHistoryEntry {
  id: string;
  prompt_preview: string; // first 100 chars, never full
  model: string;
  status: string;
  created_at: string;
  duration_ms: number;
  tokens_used: number;
  client_matter_id?: string;
  type: 'completion' | 'query' | 'rag';
}

export interface HarveyHistoryResponse {
  entries: HarveyHistoryEntry[];
  total: number;
  has_more: boolean;
}
