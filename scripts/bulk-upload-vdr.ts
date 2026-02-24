/**
 * Bulk Upload VDR Documents Script
 *
 * Uploads synthetic documents from dataroom 2 folder to VDR
 * Usage: npx tsx scripts/bulk-upload-vdr.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Project ID for FMC Due Diligence - Prototipo
const PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';
const BUCKET = 'vdr-documents';
const DATAROOM_PATH = path.join(__dirname, '..', 'dataroom 2');

// Area mapping based on folder names
const FOLDER_TO_AREA: Record<string, string> = {
  '1. Documentos Corporativos': 'MERC',
  '2. Documentos Financieros': 'FISC',
  '3. Contratos Materiales': 'CONT',
  '4. Propiedad Intelectual': 'PI',
  '5. Laboral y RRHH': 'LAB',
  '6. Litigios y Compliance': 'LIT',
};

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    if (error) {
      console.log(`Bucket already exists or error: ${error.message}`);
    } else {
      console.log(`Created bucket: ${BUCKET}`);
    }
  }
}

async function createFolder(name: string, parentId: string | null = null): Promise<string | null> {
  // Check if folder exists
  const { data: existing } = await supabase
    .from('vdr_folders')
    .select('id')
    .eq('project_id', PROJECT_ID)
    .eq('name', name)
    .eq('parent_id', parentId)
    .single();

  if (existing) {
    console.log(`  Folder exists: ${name}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('vdr_folders')
    .insert({
      project_id: PROJECT_ID,
      name,
      parent_id: parentId,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  Failed to create folder ${name}: ${error.message}`);
    return null;
  }

  console.log(`  Created folder: ${name}`);
  return data.id;
}

function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function uploadDocument(
  filePath: string,
  folderId: string,
  areaCode: string
): Promise<boolean> {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const contentHash = computeContentHash(content);
  const fileBuffer = Buffer.from(content, 'utf-8');

  // Generate storage path
  const storagePath = `${PROJECT_ID}/${folderId}/${Date.now()}-${fileName}`;

  try {
    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'text/markdown',
        upsert: false,
      });

    if (uploadError) {
      console.error(`    Storage upload failed: ${uploadError.message}`);
      return false;
    }

    // 2. Create document record (correct schema)
    const { data: doc, error: docError } = await supabase
      .from('vdr_documents')
      .insert({
        project_id: PROJECT_ID,
        folder_id: folderId,
        area_code: areaCode,
        name: fileName.replace('.md', '').replace(/_/g, ' '),
        status: 'uploaded',
        category: 'legal',
        content_hash: contentHash,
        is_confidential: false,
        tags: [areaCode.toLowerCase()],
        uploaded_by: 'aaaa0001-0000-4000-8000-000000000000', // Admin user
      })
      .select('id')
      .single();

    if (docError) {
      console.error(`    Document record failed: ${docError.message}`);
      return false;
    }

    // 3. Create version record (correct schema)
    const { error: versionError } = await supabase
      .from('vdr_document_versions')
      .insert({
        document_id: doc.id,
        version_number: 1,
        storage_path: storagePath,
        original_filename: fileName,
        file_type: 'md',
        file_size_bytes: fileBuffer.length,
        checksum_sha256: contentHash,
        uploaded_by: 'aaaa0001-0000-4000-8000-000000000000', // Admin user
      });

    if (versionError) {
      console.error(`    Version record failed: ${versionError.message}`);
      return false;
    }

    console.log(`    ✓ ${fileName}`);
    return true;
  } catch (err) {
    console.error(`    Exception: ${(err as Error).message}`);
    return false;
  }
}

async function processFolder(
  folderPath: string,
  parentFolderId: string | null,
  areaCode: string
): Promise<UploadResult> {
  const result: UploadResult = { success: 0, failed: 0, errors: [] };
  const folderName = path.basename(folderPath);

  console.log(`\nProcessing: ${folderName}`);

  // Create folder in VDR
  const folderId = await createFolder(folderName, parentFolderId);
  if (!folderId) {
    result.errors.push(`Failed to create folder: ${folderName}`);
    return result;
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively process subfolders
      const subResult = await processFolder(entryPath, folderId, areaCode);
      result.success += subResult.success;
      result.failed += subResult.failed;
      result.errors.push(...subResult.errors);
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
      // Upload markdown file
      const success = await uploadDocument(entryPath, folderId, areaCode);
      if (success) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(entry.name);
      }
    }
  }

  return result;
}

async function main() {
  console.log('=== VDR Bulk Upload ===');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Source: ${DATAROOM_PATH}`);

  // Ensure bucket exists
  await ensureBucketExists();

  const totalResult: UploadResult = { success: 0, failed: 0, errors: [] };

  // Process each top-level folder
  const topFolders = fs.readdirSync(DATAROOM_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'));

  for (const folder of topFolders) {
    const areaCode = FOLDER_TO_AREA[folder.name] || 'MERC';
    const folderPath = path.join(DATAROOM_PATH, folder.name);

    const result = await processFolder(folderPath, null, areaCode);
    totalResult.success += result.success;
    totalResult.failed += result.failed;
    totalResult.errors.push(...result.errors);
  }

  // Also process root-level markdown files
  const rootFiles = fs.readdirSync(DATAROOM_PATH, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.md') && !f.name.startsWith('.'));

  if (rootFiles.length > 0) {
    console.log('\nProcessing: Root documents');
    const rootFolderId = await createFolder('Documentos Raíz', null);

    if (rootFolderId) {
      for (const file of rootFiles) {
        const filePath = path.join(DATAROOM_PATH, file.name);
        const success = await uploadDocument(filePath, rootFolderId, 'MERC');
        if (success) {
          totalResult.success++;
        } else {
          totalResult.failed++;
          totalResult.errors.push(file.name);
        }
      }
    }
  }

  console.log('\n=== Upload Complete ===');
  console.log(`Success: ${totalResult.success}`);
  console.log(`Failed: ${totalResult.failed}`);

  if (totalResult.errors.length > 0) {
    console.log('\nFailed files:');
    totalResult.errors.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
