-- Data Room: documents uploaded for DD projects
create table if not exists public.dd_documents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references dd_projects(id) on delete cascade,
    area_code text, -- MERC, CONT, LAB, FISC, INM, PI, LIT, ADMIN, MA, DATOS, GENERAL
    name text not null,
    original_filename text not null,
    file_type text not null, -- pdf, docx, xlsx, etc.
    file_size_bytes bigint not null default 0,
    storage_path text, -- Supabase Storage path
    status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'indexed', 'error')),
    category text not null default 'general' check (category in (
        'contrato', 'escritura', 'estatutos', 'cuentas_anuales', 'nomina',
        'poliza', 'licencia', 'sentencia', 'informe', 'certificado',
        'convenio', 'acta', 'poder', 'registro', 'general'
    )),
    uploaded_by text,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Index for fast project lookups
create index if not exists idx_dd_documents_project on dd_documents(project_id);
create index if not exists idx_dd_documents_area on dd_documents(area_code);

-- RLS
alter table dd_documents enable row level security;
create policy "dd_documents_all" on dd_documents for all using (true) with check (true);

-- Gap list: expected documents by area (reference table)
create table if not exists public.dd_expected_documents (
    id uuid primary key default gen_random_uuid(),
    area_code text not null,
    category text not null,
    name text not null,
    description text,
    is_mandatory boolean default true,
    sort_order int default 0
);

alter table dd_expected_documents enable row level security;
create policy "dd_expected_documents_all" on dd_expected_documents for all using (true) with check (true);

-- Seed expected documents for main areas
insert into dd_expected_documents (area_code, category, name, description, is_mandatory, sort_order) values
-- Societario
('MERC', 'escritura', 'Escritura de constitución', 'Escritura pública de constitución de la sociedad', true, 1),
('MERC', 'estatutos', 'Estatutos sociales vigentes', 'Última versión de los estatutos sociales', true, 2),
('MERC', 'registro', 'Nota simple del Registro Mercantil', 'Nota simple actualizada', true, 3),
('MERC', 'certificado', 'Certificado de titularidad real', 'Registro de titulares reales', true, 4),
('MERC', 'acta', 'Libro de actas de la Junta', 'Actas de los últimos 3 años', false, 5),
('MERC', 'acta', 'Libro de actas del Consejo', 'Actas del Consejo de los últimos 3 años', false, 6),
-- Contratos
('CONT', 'contrato', 'Contratos financieros', 'Préstamos, créditos, líneas', true, 1),
('CONT', 'contrato', 'Contratos mercantiles principales', 'Top 10 contratos por volumen', true, 2),
('CONT', 'poliza', 'Pólizas de seguros', 'Todas las pólizas vigentes', true, 3),
('CONT', 'contrato', 'Contratos intragrupo', 'Acuerdos con sociedades vinculadas', false, 4),
-- Laboral
('LAB', 'nomina', 'Cuadro de plantilla', 'Censo actualizado de empleados', true, 1),
('LAB', 'contrato', 'Contratos alta dirección', 'Contratos de directivos y consejeros', true, 2),
('LAB', 'convenio', 'Convenio colectivo aplicable', 'Convenio vigente', true, 3),
('LAB', 'sentencia', 'Litigios laborales pendientes', 'Documentación procesal laboral', false, 4),
-- Fiscal
('FISC', 'informe', 'Declaraciones fiscales', 'IS, IVA, retenciones últimos 4 años', true, 1),
('FISC', 'certificado', 'Certificados corriente de pago', 'AEAT y TGSS', true, 2),
('FISC', 'informe', 'Documentación precios transferencia', 'Política y documentación TP', false, 3),
-- Inmobiliario
('INM', 'registro', 'Notas simples de inmuebles', 'Nota simple de cada inmueble', true, 1),
('INM', 'contrato', 'Contratos de arrendamiento', 'Arrendamientos vigentes', true, 2),
('INM', 'licencia', 'Licencias urbanísticas', 'Licencias de actividad y obra', false, 3),
-- IP
('PI', 'registro', 'Certificados de marcas', 'Registros OEPM/EUIPO', true, 1),
('PI', 'contrato', 'Licencias de PI', 'Contratos de licencia de marcas/patentes', false, 2)
on conflict do nothing;
