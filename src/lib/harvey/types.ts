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
