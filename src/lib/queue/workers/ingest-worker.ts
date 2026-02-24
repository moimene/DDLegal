/**
 * Ingest Worker - BullMQ processor for document ingestion
 *
 * Processes documents from the dd-ingest queue and delegates
 * to the VDR ingestion pipeline for vectorization.
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES, type IngestJobData } from '../index';
import { startIngestion } from '@/lib/vdr/ingest';

let worker: Worker | null = null;

export function startIngestWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<IngestJobData>(
    QUEUE_NAMES.INGEST,
    async (job: Job<IngestJobData>) => {
      const { documentId, versionId } = job.data;

      console.log(`[ingest-worker] Processing document ${documentId}`);

      try {
        const jobId = await startIngestion(documentId, versionId);
        return { success: true, ingestionJobId: jobId };
      } catch (error) {
        console.error(`[ingest-worker] Failed to process ${documentId}:`, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5, // Process 5 documents concurrently
      limiter: {
        max: 10,
        duration: 1000, // 10 jobs per second max
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[ingest-worker] Completed ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ingest-worker] Failed ${job?.id}:`, err);
  });

  return worker;
}

export async function stopIngestWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
