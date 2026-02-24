/**
 * Extraction Worker - BullMQ processor for fact extraction
 *
 * Processes documents from the dd-extraction queue and delegates
 * to the fact extractor for structured data extraction via Harvey AI.
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES, type ExtractionJobData } from '../index';
import { extractDocumentFacts } from '@/lib/worker/fact-extractor';

let worker: Worker | null = null;

export function startExtractionWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<ExtractionJobData>(
    QUEUE_NAMES.EXTRACTION,
    async (job: Job<ExtractionJobData>) => {
      const { documentId, projectId, forceReExtract } = job.data;

      console.log(`[extraction-worker] Processing document ${documentId}`);

      try {
        const result = await extractDocumentFacts(documentId, projectId, {
          forceReExtract,
        });
        return {
          success: true,
          factId: result.factId,
          cached: result.cached,
          confidence: result.extractionConfidence,
        };
      } catch (error) {
        console.error(`[extraction-worker] Failed to extract ${documentId}:`, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3, // AI calls are expensive, limit concurrency
      limiter: {
        max: 5,
        duration: 1000, // 5 extractions per second max
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[extraction-worker] Completed ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[extraction-worker] Failed ${job?.id}:`, err);
  });

  return worker;
}

export async function stopExtractionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
