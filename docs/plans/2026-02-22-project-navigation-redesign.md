# Rediseno de Navegacion Intra-Proyecto: Grupos Colapsables por Flujo de Trabajo

**Fecha:** 2026-02-22
**Estado:** Aprobado
**Alcance:** Navegacion dentro de `/projects/[id]/` (no la lista de proyectos)

## Problema

El sidebar del proyecto muestra 11 items en una lista plana sin agrupacion logica. Esto genera:

- Carga cognitiva alta: el usuario escanea 11 opciones sin guia de flujo
- Duplicidades funcionales: Q&A aparece en sidebar y como tab en Vista General; Negociacion aparece como item y como tab del War Room; Deal Cockpit se solapa con War Room
- Sin acceso directo a areas juridicas (Contratos, Laboral) como superficie de trabajo principal
- Falta de alineacion con el ciclo natural de una DD (obtener info → analizar → decidir)

## Diseno aprobado: Grupos colapsables (Enfoque B)

### Estructura de navegacion

La seccion "Proyecto" del sidebar se reorganiza en 3 grupos colapsables que reflejan el ciclo DD:

```
▼ Informacion                          [badge: conteo contextual]
   Vista General                       /projects/[id]
   Data Room                           /projects/[id]/vdr
   Q&A                                 /projects/[id]/qa

▼ Analisis                             [badge: conteo contextual]
   Kanban                              /projects/[id]/kanban
   Workflows                           /projects/[id]/workflows
   HITL Review                         /projects/[id]/hitl
   Scoring                             /projects/[id]/scoring
   ── Areas activas ──
   Contratos                           /projects/[id]/areas/CONT
   Laboral                             /projects/[id]/areas/LAB
   ...                                 (solo areas con workflows activos)

▼ Decision e Informe                   [badge: conteo contextual]
   War Room                            /projects/[id]/war-room
   Negociacion                         /projects/[id]/negotiation
   Actividad                           /projects/[id]/activity
```

### Decisiones sobre duplicidades

| Duplicidad | Decision | Razon |
|---|---|---|
| Q&A en sidebar vs tab en Vista General | **Mantener ambos** | Tab = resumen/acceso rapido. Sidebar = modulo completo con SLAs y routing |
| Negociacion (sidebar) vs War Room > tab Negociacion | **Eliminar tab del War Room** | El modulo Negociacion del sidebar es la vista completa |
| Deal Cockpit vs War Room | **Eliminar Deal Cockpit** | War Room cubre la funcion de consola ejecutiva; Cockpit es redundante |

### Comportamiento de los grupos

- **Estado por defecto:** Se expande el grupo que contiene la ruta activa; los otros colapsados
- **Persistencia:** Estado abierto/cerrado en `localStorage` por proyecto
- **Indicadores:** Badge informativo en cada header de grupo (ej: "3 red flags", "2 HITL pendientes")
- **Grupo activo:** Acento visual (borde izquierdo de color o fondo sutil)
- **Sidebar colapsado:** 3 iconos con popover al hover

### Areas juridicas (sub-seccion dentro de Analisis)

- Solo muestra areas con workflows activos en el proyecto
- Cada area enlaza a `/projects/[id]/areas/[area_code]`
- La pagina de area muestra tablas normalizadas como vista principal con filtros por enumeraciones
- Separador sutil "Areas activas" antes de la lista

## Cambios respecto al estado actual

1. **Eliminado:** Deal Cockpit (`/projects/[id]/cockpit`) — absorbido por War Room
2. **Eliminada:** Tab "Negociacion" dentro del War Room
3. **Nuevo:** 3 bloques colapsables con headers en sidebar
4. **Nuevo:** Sub-seccion "Areas activas" con rutas `/projects/[id]/areas/[code]`
5. **Nuevo:** Badges informativos en headers de grupo
6. **Mantenido:** Todas las URLs existentes intactas (excepto cockpit)

## Impacto tecnico

### Archivos a modificar
- `src/components/layout/sidebar.tsx` — reemplazar array plano por estructura de grupos con colapso
- `src/app/projects/[id]/war-room/page.tsx` — eliminar tab "Negociacion"

### Archivos a crear
- `src/app/projects/[id]/areas/[code]/page.tsx` — vista de area con tablas normalizadas

### Archivos a eliminar
- `src/app/projects/[id]/cockpit/page.tsx` — ruta Deal Cockpit

### APIs/queries nuevas
- Query para contar items por grupo (docs pendientes, HITL pendientes, red flags)
- Query para obtener areas activas del proyecto (workflows publicados)

## Fuentes

Basado en las evaluaciones expertas:
- "Evaluacion experta del estado y la usabilidad del DD Legal PMO/Deal Cockpit"
- "Senales unificadas, navegacion a evidencia y disciplina de listo para comite"
- Recomendacion clave de ambos documentos: agrupacion visual en tres tramos (preparacion, analisis IA/validacion humana, cierre/informe)
