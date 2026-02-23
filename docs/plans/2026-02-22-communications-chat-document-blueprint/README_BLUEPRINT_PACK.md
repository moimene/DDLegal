# Blueprint Pack: Comunicaciones + Chat + Gestor Documental

Paquete reutilizable para replicar en otros desarrollos el nucleo de:

- PRD de `Comunicaciones + Chat`.
- PRD de `Gestor Documental`.
- Arquitectura de implantacion `Vercel + Supabase` con gobierno tecnico.

## Contenido

1. `docs/blueprints/PRD_COMUNICACIONES_CHAT_BLUEPRINT.md`
2. `docs/blueprints/PRD_GESTOR_DOCUMENTAL_BLUEPRINT.md`
3. `docs/blueprints/IMPLANTACION_VERCEL_SUPABASE_GOBERNADA.md`

## Como usar este paquete en otros proyectos

1. Clona estos tres documentos al repositorio destino.
2. Reemplaza campos de contexto: dominio de negocio, roles, estados y canales.
3. Mantiene el esqueleto de requisitos (`FR-*`, `NFR-*`, `AC-*`) para facilitar QA y trazabilidad.
4. Implementa primero la base gobernada (Auth, RLS, auditoria, observabilidad) y despues UI/UX.
5. Ejecuta el checklist de implantacion del documento de arquitectura antes de liberar produccion.

## Resultado esperado

- Producto con requisitos claros y medibles.
- Datos y permisos gobernados desde origen.
- Despliegues repetibles en Vercel + Supabase para portfolio multi-proyecto.
