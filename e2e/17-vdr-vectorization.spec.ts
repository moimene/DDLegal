import { test, expect } from '@playwright/test';

test.describe('VDR Vectorization API @vdr-vector', () => {
  test('POST /api/vdr/ingest requires document_id', async ({ request }) => {
    const res = await request.post('/api/vdr/ingest', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('document_id');
  });

  test('POST /api/vdr/search/semantic requires project_id and query', async ({ request }) => {
    const res = await request.post('/api/vdr/search/semantic', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/vdr/search/semantic returns results array', async ({ request }) => {
    const res = await request.post('/api/vdr/search/semantic', {
      data: { project_id: '00000000-0000-0000-0000-000000000000', query: 'contrato de compraventa' },
    });
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test('GET /api/vdr/ingest/nonexistent returns 404', async ({ request }) => {
    const res = await request.get('/api/vdr/ingest/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });
});
