/**
 * BullMQ Queue System - Horizonte 2 (G-23)
 *
 * Central queue management for async processing:
 * - Document ingestion
 * - Fact extraction
 * - FO evaluation
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection - use REDIS_URL env var or default to localhost
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    connection.on('error', (err) => {
      console.error('[queue] Redis connection error:', err);
    });

    connection.on('connect', () => {
      console.log('[queue] Connected to Redis');
    });
  }
  return connection;
}

// Queue definitions
export const QUEUE_NAMES = {
  INGEST: 'dd-ingest',
  EXTRACTION: 'dd-extraction',
  EVALUATION: 'dd-evaluation',
  WORKER_CYCLE: 'dd-worker-cycle',
} as const;

// Queue instances (lazy-initialized)
const queues: Map<string, Queue> = new Map();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 500,     // Keep last 500 failed
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

// Job type definitions
export interface IngestJobData {
  documentId: string;
  versionId?: string;
  projectId: string;
  priority?: number;
}

export interface ExtractionJobData {
  documentId: string;
  projectId: string;
  forceReExtract?: boolean;
}

export interface EvaluationJobData {
  projectId: string;
  objectiveKey?: string;
  documentId?: string;
  batchSize?: number;
}

export interface WorkerCycleJobData {
  projectId: string;
  mode: 'continuous' | 'targeted' | 'full_sweep' | 'on_demand';
  targetArea?: string;
}

// Queue helpers
export async function enqueueIngest(data: IngestJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.INGEST);
  const job = await queue.add('ingest', data, {
    priority: data.priority || 0,
    jobId: `ingest:${data.documentId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueExtraction(data: ExtractionJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EXTRACTION);
  const job = await queue.add('extract', data, {
    jobId: `extract:${data.documentId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueEvaluation(data: EvaluationJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EVALUATION);
  const job = await queue.add('evaluate', data, {
    jobId: `evaluate:${data.projectId}:${Date.now()}`,
  });
  return job.id || '';
}

export async function enqueueWorkerCycle(data: WorkerCycleJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.WORKER_CYCLE);
  const job = await queue.add('cycle', data, {
    jobId: `cycle:${data.projectId}:${Date.now()}`,
  });
  return job.id || '';
}

// Queue stats
export async function getQueueStats(queueName: string) {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  const queueList = Array.from(queues.values());
  for (const queue of queueList) {
    await queue.close();
  }
  queues.clear();

  if (connection) {
    await connection.quit();
    connection = null;
  }
}
