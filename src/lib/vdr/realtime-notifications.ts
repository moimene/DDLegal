/**
 * VDR Realtime Notifications — Horizonte 2 (G-04)
 *
 * Publishes events to Supabase Realtime when VDR documents change.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

export type VdrEventType =
  | 'document_uploaded'
  | 'document_ingested'
  | 'document_classified'
  | 'document_extracted'
  | 'gap_analysis_updated';

export interface VdrNotification {
  type: VdrEventType;
  projectId: string;
  documentId?: string;
  documentName?: string;
  areaCode?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Publish a VDR event to Supabase Realtime.
 * Clients can subscribe to `vdr-events:{projectId}` channel.
 */
export async function publishVdrEvent(notification: VdrNotification): Promise<void> {
  const channel = `vdr-events:${notification.projectId}`;

  try {
    // Use Supabase's broadcast feature
    await supabaseAdmin
      .channel(channel)
      .send({
        type: 'broadcast',
        event: notification.type,
        payload: notification,
      });

    console.log(`[vdr-realtime] Published ${notification.type} to ${channel}`);
  } catch (error) {
    console.error(`[vdr-realtime] Failed to publish event:`, error);
    // Non-blocking: don't throw, just log
  }
}

/**
 * Notify document uploaded.
 */
export async function notifyDocumentUploaded(
  projectId: string,
  documentId: string,
  documentName: string,
  areaCode?: string
): Promise<void> {
  await publishVdrEvent({
    type: 'document_uploaded',
    projectId,
    documentId,
    documentName,
    areaCode,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify document ingested (chunked & embedded).
 */
export async function notifyDocumentIngested(
  projectId: string,
  documentId: string,
  documentName: string,
  chunksCreated: number
): Promise<void> {
  await publishVdrEvent({
    type: 'document_ingested',
    projectId,
    documentId,
    documentName,
    timestamp: new Date().toISOString(),
    metadata: { chunksCreated },
  });
}

/**
 * Notify document classified.
 */
export async function notifyDocumentClassified(
  projectId: string,
  documentId: string,
  documentName: string,
  documentType: string,
  areaCodes: string[],
  confidence: number
): Promise<void> {
  await publishVdrEvent({
    type: 'document_classified',
    projectId,
    documentId,
    documentName,
    areaCode: areaCodes[0],
    timestamp: new Date().toISOString(),
    metadata: { documentType, areaCodes, confidence },
  });
}

/**
 * Notify document facts extracted.
 */
export async function notifyDocumentExtracted(
  projectId: string,
  documentId: string,
  documentName: string,
  extractionConfidence: number,
  cached: boolean
): Promise<void> {
  await publishVdrEvent({
    type: 'document_extracted',
    projectId,
    documentId,
    documentName,
    timestamp: new Date().toISOString(),
    metadata: { extractionConfidence, cached },
  });
}

/**
 * Notify gap analysis updated.
 */
export async function notifyGapAnalysisUpdated(
  projectId: string,
  coveragePercent: number,
  gapsCount: number
): Promise<void> {
  await publishVdrEvent({
    type: 'gap_analysis_updated',
    projectId,
    timestamp: new Date().toISOString(),
    metadata: { coveragePercent, gapsCount },
  });
}
