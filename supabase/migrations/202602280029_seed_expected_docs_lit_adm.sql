BEGIN;

-- LIT - Litigios (5 documents)
INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory)
VALUES
  ('LIT', 'procedimientos', 'Relación de procedimientos judiciales pendientes', 'Listado de todos los procedimientos judiciales y arbitrajes activos', true),
  ('LIT', 'provisiones', 'Cuadro de contingencias y provisiones (NIC 37)', 'Cuadro con estimación de probabilidad e impacto de contingencias litigiosas', true),
  ('LIT', 'compliance', 'Informe de compliance / Canal de denuncias', 'Programa de cumplimiento normativo y canal de denuncias', false),
  ('LIT', 'rgpd', 'Documentación RGPD y protección de datos', 'Registro de actividades, contratos de encargado, evaluaciones de impacto', false),
  ('LIT', 'medioambiente', 'Informes de pasivos medioambientales', 'Evaluaciones ambientales, permisos, planes de remediación', false);

-- ADM - Administrativo (5 documents)
INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory)
VALUES
  ('ADM', 'licencias', 'Licencias y autorizaciones administrativas', 'Licencias de actividad, autorizaciones sectoriales, permisos de explotación', true),
  ('ADM', 'urbanismo', 'Documentación urbanística', 'Licencias de obra, certificados de conformidad, cédulas de habitabilidad', true),
  ('ADM', 'subvenciones', 'Expedientes de subvenciones recibidas', 'Resoluciones de concesión, justificaciones, obligaciones pendientes', false),
  ('ADM', 'contratos_publicos', 'Contratos con Administraciones Públicas', 'Contratos de licitación pública, encomiendas de gestión', false),
  ('ADM', 'fdi', 'Documentación FDI screening / merger control', 'Autorizaciones de inversión extranjera, notificaciones de concentración', false);

COMMIT;
