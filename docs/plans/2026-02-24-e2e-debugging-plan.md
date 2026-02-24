# Plan de Depuración E2E — 30 Tests Fallidos

> **Fecha**: 2026-02-24
> **Estado**: 248 passed, 30 failed, 34 skipped

## Análisis de Causa Raíz

### Problema Principal: Cascada de Autenticación

```
00-setup.spec.ts:66 "seed test users" FALLA
    └─> clo@test.ddlegal.com tiene status "error"
        └─> Todos los tests que dependen de auth fallan con 401
            └─> 28 tests adicionales fallan en cascada
```

**Error específico**: `User clo@test.ddlegal.com has unexpected status "error"`

---

## Categorización de los 30 Fallos

### Grupo A: Setup/Seed (1 test) — CRÍTICO
| Test | Archivo | Línea | Error |
|------|---------|-------|-------|
| seed test users @setup | 00-setup.spec.ts | 66 | clo@test.ddlegal.com status "error" |

**Causa**: Fallo al crear usuario en Supabase Auth (posiblemente ya existe con otra configuración o email_confirm issue).

---

### Grupo B: Auth Cascade (15 tests)
Tests que fallan porque dependen del setup de usuarios.

| Test | Archivo | Error |
|------|---------|-------|
| sidebar shows Proyecto section | 02-navigation.spec.ts:265 | Auth 401 |
| Seguridad loads without 500 | 02-navigation.spec.ts:359 | Auth 401 |
| Nuevo Proyecto loads without 500 | 02-navigation.spec.ts:359 | Auth 401 |
| header displays logged-in user email | 02-navigation.spec.ts:395 | Auth 401 |
| notification bell is visible | 02-navigation.spec.ts:411 | Auth 401 |
| Dashboard link has aria-current | 02-navigation.spec.ts:426 | Auth 401 |
| Hub Herramientas aria-current | 02-navigation.spec.ts:448 | Auth 401 |
| non-active links NO aria-current | 02-navigation.spec.ts:459 | Auth 401 |
| Proyecto activo badge appears | 02-navigation.spec.ts:478 | Auth 401 |
| Proyecto activo badge NOT visible | 02-navigation.spec.ts:492 | Auth 401 |
| setup authenticate project (events) | 08-events.spec.ts:169 | Auth 401 |
| setup authenticate project (cockpit) | 09-cockpit.spec.ts:128 | Auth 401 |
| cliente_externo login | 11-client-portal.spec.ts:90 | Auth 401 |
| setup resolve project (VDR API) | 04-vdr.spec.ts:176 | Auth 401 |
| setup resolve project (VDR Browser) | 04-vdr.spec.ts:583 | Auth 401 |

---

### Grupo C: Project Detail Tests (9 tests)
Tests que fallan porque no pueden autenticarse o el proyecto no existe.

| Test | Archivo | Error |
|------|---------|-------|
| projects listing visible | 03-projects.spec.ts:205 | No auth |
| clicking each tab loads content | 03-projects.spec.ts:423 | No auth |
| KPI cards with numbers visible | 03-projects.spec.ts:460 | No auth |
| quick access grid 9 cards | 03-projects.spec.ts:487 | Timeout |
| Tab Equipo roles displayed | 03-projects.spec.ts:520 | No auth |
| Tab Eventos EventFeed visible | 03-projects.spec.ts:564 | No auth |
| Tab IA Insights visible | 03-projects.spec.ts:603 | No auth |
| Badge review_depth visible | 03-projects.spec.ts:639 | No auth |
| setup discover project (QA) | 05-qa.spec.ts:181 | No auth |

---

### Grupo D: Tools/Config Pages (5 tests)
Tests de UI que fallan por falta de autenticación.

| Test | Archivo | Error |
|------|---------|-------|
| /tools renders heading and cards | 07-tools.spec.ts:121 | No auth |
| /tools/societario renders form | 07-tools.spec.ts:161 | No auth |
| /tools/ip-radar renders form | 07-tools.spec.ts:186 | No auth |
| /skills renders heading | 07-tools.spec.ts:239 | No auth |
| Societario form fields | 07-tools.spec.ts:274 | No auth |
| IP Radar form fields | 07-tools.spec.ts:296 | No auth |
| Marcas form fields | 07-tools.spec.ts:321 | No auth |
| Reports listing loads | 06-reports.spec.ts:178 | No auth |

---

### Grupo E: Config Pages (6 tests)

| Test | Archivo | Error |
|------|---------|-------|
| Estado del Sistema loads | 10-config.spec.ts:126 | No auth |
| Catalogo Skills loads | 10-config.spec.ts:149 | No auth |
| Gestion Herramientas loads | 10-config.spec.ts:170 | No auth |
| Plantillas loads | 10-config.spec.ts:214 | No auth |
| Dominios loads | 10-config.spec.ts:239 | No auth |
| Seguridad loads | 10-config.spec.ts:261 | No auth |

---

### Grupo F: Kanban API (1 test)

| Test | Archivo | Error |
|------|---------|-------|
| PATCH move respects WIP limits | 14-kanban.spec.ts:48 | Lógica/Auth |

---

## Plan de Depuración por Prioridad

### Fase 1: Fix Setup (CRÍTICO)
**Objetivo**: Resolver el fallo de seed test users

#### Paso 1.1: Diagnosticar el error de creación de usuario
```bash
# Verificar si el usuario ya existe en Supabase
curl -X GET "https://mxanelzxyaklvuypuafa.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" | jq '.users[] | select(.email | contains("test.ddlegal"))'
```

#### Paso 1.2: Revisar logs del endpoint
```typescript
// Añadir logging detallado en setup-test-users/route.ts
console.error('[setup-test-users] Error creating user:', {
  email: testUser.email,
  error: createError,
  errorCode: createError?.code,
  errorMessage: createError?.message,
});
```

#### Paso 1.3: Posibles fixes
1. **Si usuario existe con email diferente**: Actualizar en lugar de crear
2. **Si email_confirm falla**: Verificar configuración de Supabase Auth
3. **Si rate limit**: Añadir delays entre creaciones

```typescript
// Fix propuesto para setup-test-users/route.ts línea 90
const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
  email: testUser.email,
  password: TEST_PASSWORD,
  email_confirm: true,  // Puede fallar si SMTP no está configurado
  // Alternativa: usar signUp en lugar de createUser admin
});

// Si falla por email existente, intentar update
if (createError?.message?.includes('already registered')) {
  const { data: existingUser } = await supabaseAdmin.auth.admin.updateUserById(
    existingUser.id,
    { password: TEST_PASSWORD, email_confirm: true }
  );
}
```

**Archivos a modificar**:
- `src/app/api/auth/setup-test-users/route.ts`

**Comando de verificación**:
```bash
npx playwright test e2e/00-setup.spec.ts --reporter=line
```

---

### Fase 2: Fix Auth Flow
**Objetivo**: Asegurar que login funciona para todos los roles

#### Paso 2.1: Verificar endpoint de login
```bash
# Test manual de login
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"pm@test.ddlegal.com","password":"test123456"}'
```

#### Paso 2.2: Revisar login/route.ts
- Verificar que `signInWithPassword` funciona
- Verificar que devuelve `access_token` correctamente

**Archivos a revisar**:
- `src/app/api/auth/login/route.ts`

---

### Fase 3: Fix Navigation Tests
**Objetivo**: Una vez auth funciona, verificar UI

**Dependencia**: Fase 1 + 2 completadas

```bash
npx playwright test e2e/02-navigation.spec.ts --reporter=line
```

---

### Fase 4: Fix Project Detail Tests
**Objetivo**: Verificar que las páginas de proyecto cargan correctamente

**Dependencia**: Fase 1 + 2 + 3 completadas

```bash
npx playwright test e2e/03-projects.spec.ts --reporter=line
```

---

### Fase 5: Fix Tools/Config Tests
**Objetivo**: Verificar páginas de herramientas y configuración

```bash
npx playwright test e2e/07-tools.spec.ts e2e/10-config.spec.ts --reporter=line
```

---

### Fase 6: Fix Remaining Tests
**Objetivo**: VDR, QA, Reports, Kanban

```bash
npx playwright test e2e/04-vdr.spec.ts e2e/05-qa.spec.ts e2e/06-reports.spec.ts e2e/14-kanban.spec.ts --reporter=line
```

---

## Checklist de Ejecución

- [ ] **Fase 1.1**: Diagnosticar error de seed users
- [ ] **Fase 1.2**: Añadir logging detallado
- [ ] **Fase 1.3**: Aplicar fix a setup-test-users
- [ ] **Fase 1.4**: Verificar seed test pasa
- [ ] **Fase 2.1**: Verificar login endpoint
- [ ] **Fase 2.2**: Verificar auth/me endpoint
- [ ] **Fase 3**: Navigation tests pasan
- [ ] **Fase 4**: Project detail tests pasan
- [ ] **Fase 5**: Tools/Config tests pasan
- [ ] **Fase 6**: Remaining tests pasan
- [ ] **Final**: Full test suite ≥290 passed

---

## Comandos Útiles

```bash
# Run single test file
npx playwright test e2e/00-setup.spec.ts --reporter=line

# Run with debug
npx playwright test e2e/00-setup.spec.ts --debug

# Run with headed browser
npx playwright test e2e/00-setup.spec.ts --headed

# Run specific test by title
npx playwright test -g "seed test users"

# Show trace on failure
npx playwright test --trace on

# Run all tests with verbose output
npx playwright test --reporter=list
```

---

## Estimación de Esfuerzo

| Fase | Tests Afectados | Complejidad |
|------|-----------------|-------------|
| Fase 1 (Setup) | 1 + cascade | Alta |
| Fase 2 (Auth) | ~15 | Media |
| Fase 3 (Nav) | ~10 | Baja |
| Fase 4 (Projects) | ~9 | Baja |
| Fase 5 (Tools) | ~8 | Baja |
| Fase 6 (Rest) | ~4 | Media |

**Nota**: El 90% de los fallos se resolverán al arreglar Fase 1 (seed users).
