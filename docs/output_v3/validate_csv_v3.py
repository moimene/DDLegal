#!/usr/bin/env python3
"""
Validador de integridad referencial para el dataset sintético DDLegal v3.
Verifica todos los ajustes de cobertura exhaustiva aplicados.
"""

import csv
import json
import os
import sys
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG_FILE = "00_catalog_values.csv"


def resolve_base_dir():
    """Resolve dataset directory in this priority:
    1) CLI arg: python validate_csv_v3.py /path/to/output_v3
    2) Env var: DD_SYNTHETIC_BASE_DIR
    3) Script directory (default, expected layout)
    4) Legacy sibling fallback: ../synthetic-data-intake
    """
    candidates = []
    if len(sys.argv) > 1 and sys.argv[1].strip():
        candidates.append(sys.argv[1].strip())
    env_dir = os.getenv("DD_SYNTHETIC_BASE_DIR", "").strip()
    if env_dir:
        candidates.append(env_dir)
    candidates.append(SCRIPT_DIR)
    candidates.append(os.path.normpath(os.path.join(SCRIPT_DIR, "..", "synthetic-data-intake")))

    for candidate in candidates:
        if os.path.isfile(os.path.join(candidate, CATALOG_FILE)):
            return candidate

    print("[ERROR] No se pudo resolver BASE_DIR con un dataset valido.")
    print("        Ejecuta con ruta explicita, por ejemplo:")
    print("        python validate_csv_v3.py /ruta/a/output_v3")
    sys.exit(1)


BASE_DIR = resolve_base_dir()

def read_csv(filename):
    filepath = os.path.join(BASE_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)

def collect_codes(rows, field):
    return set(r[field] for r in rows if r.get(field, "").strip())

def validate_refs(source_name, source_rows, source_field, target_name, target_codes, errors):
    for i, row in enumerate(source_rows, 1):
        val = row.get(source_field, "").strip()
        if val and val not in target_codes:
            errors.append(f"  [ERROR] {source_name} row {i}: {source_field}='{val}' not found in {target_name}")

def validate_catalog(rows, field, domain, catalog_values, errors, source_name):
    allowed = catalog_values.get(domain, set())
    for i, row in enumerate(rows, 1):
        val = row.get(field, "").strip()
        if val and val not in allowed:
            errors.append(f"  [ERROR] {source_name} row {i}: {field}='{val}' not in catalog domain '{domain}' (allowed: {sorted(allowed)})")

print("=" * 70)
print("VALIDADOR v3 - DATASET SINTÉTICO DDLegal (COBERTURA EXHAUSTIVA)")
print("=" * 70)
print(f"BASE_DIR: {BASE_DIR}")

errors = []
warnings = []

print("\nCargando archivos CSV...")
catalog = read_csv("00_catalog_values.csv")
projects = read_csv("01_projects.csv")
roles = read_csv("02_project_roles.csv")
tasks = read_csv("03_tasks_kanban.csv")
contingencies = read_csv("04_contingencies.csv")
cont_ext = read_csv("05_contingencies_ext.csv")
clause_map = read_csv("06_contingency_clause_map.csv")
vdr_docs = read_csv("07_vdr_documents.csv")
qa_threads = read_csv("08_qa_threads.csv")
qa_messages = read_csv("09_qa_messages.csv")
hitl = read_csv("10_hitl_decisions.csv")
reports = read_csv("11_reports.csv")
war_decisions = read_csv("12_war_room_decisions.csv")
war_notifications = read_csv("13_war_room_notifications.csv")
risk_scores = read_csv("14_deal_risk_scores.csv")
evidence = read_csv("15_evidence.csv")
workflows = read_csv("16_workflow_instances_optional.csv")

# Build catalog lookup
catalog_values = {}
for row in catalog:
    domain = row["domain"]
    value = row["value"]
    if domain not in catalog_values:
        catalog_values[domain] = set()
    catalog_values[domain].add(value)

# Build primary key sets
project_codes = collect_codes(projects, "project_code")
task_codes = collect_codes(tasks, "task_code")
contingency_codes = collect_codes(contingencies, "contingency_code")
thread_codes = collect_codes(qa_threads, "thread_code")
report_codes = collect_codes(reports, "report_code")
doc_codes = collect_codes(vdr_docs, "doc_code")
workflow_refs = collect_codes(workflows, "workflow_instance_ref")

print(f"  Proyectos: {len(projects)}")
print(f"  Roles: {len(roles)}")
print(f"  Tareas: {len(tasks)}")
print(f"  Contingencias: {len(contingencies)}")
print(f"  Contingencias ext: {len(cont_ext)}")
print(f"  Mapeo clausulas: {len(clause_map)}")
print(f"  Documentos VDR: {len(vdr_docs)}")
print(f"  Hilos QA: {len(qa_threads)}")
print(f"  Mensajes QA: {len(qa_messages)}")
print(f"  Decisiones HITL: {len(hitl)}")
print(f"  Reportes: {len(reports)}")
print(f"  Decisiones War Room: {len(war_decisions)}")
print(f"  Notificaciones War Room: {len(war_notifications)}")
print(f"  Scores de riesgo: {len(risk_scores)}")
print(f"  Evidencias: {len(evidence)}")
print(f"  Instancias workflow: {len(workflows)}")

print("\n" + "=" * 70)
print("VALIDACION DE REFERENCIAS CRUZADAS")
print("=" * 70)

# 1. project_code references
print("\n[1] Validando project_code en todos los archivos...")
for name, rows in [
    ("02_project_roles", roles), ("03_tasks_kanban", tasks),
    ("04_contingencies", contingencies), ("07_vdr_documents", vdr_docs),
    ("08_qa_threads", qa_threads), ("10_hitl_decisions", hitl),
    ("11_reports", reports), ("12_war_room_decisions", war_decisions),
    ("13_war_room_notifications", war_notifications),
    ("14_deal_risk_scores", risk_scores), ("15_evidence", evidence),
    ("16_workflow_instances", workflows),
]:
    validate_refs(name, rows, "project_code", "01_projects", project_codes, errors)
print(f"  OK")

# 2. task_code references
print("\n[2] Validando task_code en archivos dependientes...")
for name, rows, field in [
    ("04_contingencies", contingencies, "linked_task_code"),
    ("08_qa_threads", qa_threads, "related_task_code"),
    ("10_hitl_decisions", hitl, "task_code"),
    ("15_evidence", evidence, "task_code"),
]:
    for i, row in enumerate(rows, 1):
        val = row.get(field, "").strip()
        if val and val not in task_codes:
            errors.append(f"  [ERROR] {name} row {i}: {field}='{val}' not found in 03_tasks_kanban")
print(f"  OK")

# 3. contingency_code references
print("\n[3] Validando contingency_code en archivos dependientes...")
for name, rows, field in [
    ("05_contingencies_ext", cont_ext, "contingency_code"),
    ("06_contingency_clause_map", clause_map, "contingency_code"),
    ("08_qa_threads", qa_threads, "related_contingency_code"),
    ("12_war_room_decisions", war_decisions, "contingency_code"),
    ("15_evidence", evidence, "contingency_code"),
]:
    for i, row in enumerate(rows, 1):
        val = row.get(field, "").strip()
        if val and val not in contingency_codes:
            errors.append(f"  [ERROR] {name} row {i}: {field}='{val}' not found in 04_contingencies")
print(f"  OK")

# 4. thread_code references
print("\n[4] Validando thread_code en mensajes QA...")
for i, row in enumerate(qa_messages, 1):
    val = row.get("thread_code", "").strip()
    if val and val not in thread_codes:
        errors.append(f"  [ERROR] 09_qa_messages row {i}: thread_code='{val}' not found in 08_qa_threads")
print(f"  OK - {len(qa_messages)} mensajes")

# 5. report_code references
print("\n[5] Validando report_code en evidencias...")
for i, row in enumerate(evidence, 1):
    val = row.get("report_code", "").strip()
    if val and val not in report_codes:
        errors.append(f"  [ERROR] 15_evidence row {i}: report_code='{val}' not found in 11_reports")
print(f"  OK")

# 6. workflow_instance_ref in HITL
print("\n[6] Validando workflow_instance_ref en decisiones HITL...")
for i, row in enumerate(hitl, 1):
    val = row.get("workflow_instance_ref", "").strip()
    if val and val not in workflow_refs:
        errors.append(f"  [ERROR] 10_hitl_decisions row {i}: workflow_instance_ref='{val}' not found in 16_workflow_instances")
print(f"  OK")

# 7. Catalog validation for key fields
print("\n[7] Validando valores de catalogo...")
validate_catalog(tasks, "state", "kanban_state", catalog_values, errors, "03_tasks_kanban")
validate_catalog(tasks, "priority", "priority", catalog_values, errors, "03_tasks_kanban")
validate_catalog(tasks, "ai_status", "task_ai_status", catalog_values, errors, "03_tasks_kanban")
validate_catalog(contingencies, "severity", "priority", catalog_values, errors, "04_contingencies")
validate_catalog(contingencies, "probability", "contingency_probability", catalog_values, errors, "04_contingencies")
validate_catalog(contingencies, "status", "contingency_status", catalog_values, errors, "04_contingencies")
validate_catalog(cont_ext, "treatment", "contingency_treatment", catalog_values, errors, "05_contingencies_ext")
validate_catalog(cont_ext, "basket_type", "basket_type", catalog_values, errors, "05_contingencies_ext")
validate_catalog(cont_ext, "negotiation_status", "negotiation_status", catalog_values, errors, "05_contingencies_ext")
validate_catalog(qa_threads, "status", "qa_status", catalog_values, errors, "08_qa_threads")
validate_catalog(qa_threads, "source", "qa_source", catalog_values, errors, "08_qa_threads")
validate_catalog(qa_messages, "sender_role", "qa_sender_role", catalog_values, errors, "09_qa_messages")
validate_catalog(hitl, "status", "hitl_status", catalog_values, errors, "10_hitl_decisions")
validate_catalog(reports, "status", "report_status", catalog_values, errors, "11_reports")
validate_catalog(reports, "report_category", "report_category", catalog_values, errors, "11_reports")
validate_catalog(reports, "visibility", "report_visibility", catalog_values, errors, "11_reports")
validate_catalog(war_decisions, "decision_type", "war_decision_type", catalog_values, errors, "12_war_room_decisions")
validate_catalog(war_notifications, "notification_type", "war_notification_type", catalog_values, errors, "13_war_room_notifications")
validate_catalog(risk_scores, "recommendation", "deal_recommendation", catalog_values, errors, "14_deal_risk_scores")
validate_catalog(evidence, "source_type", "evidence_source_type", catalog_values, errors, "15_evidence")
validate_catalog(vdr_docs, "status", "vdr_status", catalog_values, errors, "07_vdr_documents")
validate_catalog(vdr_docs, "category", "vdr_category", catalog_values, errors, "07_vdr_documents")
print(f"  OK")

# 8. Workflow template_key validation
print("\n[8] Validando template_key en workflow_instances...")
valid_template_keys = catalog_values.get("workflow_template_key", set())
for i, row in enumerate(workflows, 1):
    val = row.get("template_key", "").strip()
    if val and val not in valid_template_keys:
        errors.append(f"  [ERROR] 16_workflow_instances row {i}: template_key='{val}' not in catalog workflow_template_key")
print(f"  OK")

# 9. Workflow instance status validation
print("\n[9] Validando status en workflow_instances...")
valid_wf_statuses = catalog_values.get("workflow_instance_status", set())
for i, row in enumerate(workflows, 1):
    val = row.get("status", "").strip()
    if val and val not in valid_wf_statuses:
        errors.append(f"  [ERROR] 16_workflow_instances row {i}: status='{val}' not in catalog workflow_instance_status")
print(f"  OK")

# 10. Workflow phase validation
print("\n[10] Validando workflow_phase en tareas y workflow_instances...")
valid_phases = catalog_values.get("workflow_phase", set())
for i, row in enumerate(tasks, 1):
    val = row.get("workflow_phase", "").strip()
    if val and val not in valid_phases:
        errors.append(f"  [ERROR] 03_tasks_kanban row {i}: workflow_phase='{val}' not in catalog workflow_phase")
for i, row in enumerate(workflows, 1):
    val = row.get("current_phase", "").strip()
    if val and val not in valid_phases:
        errors.append(f"  [ERROR] 16_workflow_instances row {i}: current_phase='{val}' not in catalog workflow_phase")
print(f"  OK")

# 11. Workflow_key in tasks validation
print("\n[11] Validando workflow_key en tareas...")
for i, row in enumerate(tasks, 1):
    val = row.get("workflow_key", "").strip()
    if val and val not in valid_template_keys:
        errors.append(f"  [ERROR] 03_tasks_kanban row {i}: workflow_key='{val}' not in catalog workflow_template_key")
print(f"  OK")

print("\n" + "=" * 70)
print("VERIFICACION DE COBERTURA EXHAUSTIVA (10 REQUISITOS)")
print("=" * 70)

# A. Workflow template_keys alineados
print("\n[A] Workflow template_keys alineados con catalogo real:")
wf_keys_used = set(r.get("template_key","") for r in workflows)
wf_keys_tasks = set(r.get("workflow_key","") for r in tasks if r.get("workflow_key",""))
invalid_wf_keys = (wf_keys_used | wf_keys_tasks) - valid_template_keys
if invalid_wf_keys:
    errors.append(f"  [ERROR] Template keys invalidos: {invalid_wf_keys}")
    print(f"  FAIL: {invalid_wf_keys}")
else:
    print(f"  OK - Keys usados: {sorted(wf_keys_used | wf_keys_tasks)}")

# B. workflow_instances sin status=blocked
print("\n[B] workflow_instances sin status=blocked:")
blocked_wf = [r for r in workflows if r.get("status","") == "blocked"]
if blocked_wf:
    errors.append(f"  [ERROR] {len(blocked_wf)} workflow_instances con status=blocked")
    print(f"  FAIL: {[r['workflow_instance_ref'] for r in blocked_wf]}")
else:
    wf_statuses_used = Counter(r.get("status","") for r in workflows)
    print(f"  OK - Statuses: {dict(wf_statuses_used)}")

# C. Fases validas en tareas (no ia_propuesta, no conclusion)
print("\n[C] Fases validas en tareas (no ia_propuesta, no conclusion):")
invalid_phases_tasks = [r for r in tasks if r.get("workflow_phase","") in ("ia_propuesta","conclusion")]
if invalid_phases_tasks:
    errors.append(f"  [ERROR] {len(invalid_phases_tasks)} tareas con fases invalidas")
    print(f"  FAIL: {[(r['task_code'],r['workflow_phase']) for r in invalid_phases_tasks]}")
else:
    phases_used = Counter(r.get("workflow_phase","") for r in tasks if r.get("workflow_phase",""))
    print(f"  OK - Fases usadas: {dict(phases_used)}")

# D. Reportes con visibilidades client y counterparty
print("\n[D] Reportes con visibilidades client y counterparty:")
report_visibilities = set(r.get("visibility","") for r in reports)
missing_vis = {"client","counterparty"} - report_visibilities
if missing_vis:
    errors.append(f"  [ERROR] Visibilidades faltantes en reportes: {missing_vis}")
    print(f"  FAIL: Faltantes: {missing_vis}")
else:
    print(f"  OK - Visibilidades: {sorted(report_visibilities)}")

# E. Contingencias con mitigated, resolved, accepted y low severity
print("\n[E] Contingencias con estados mitigated/resolved/accepted y severidad low:")
cont_statuses = set(r.get("status","") for r in contingencies)
cont_severities = set(r.get("severity","") for r in contingencies)
missing_statuses = {"mitigated","resolved","accepted"} - cont_statuses
missing_sev = {"low"} - cont_severities
if missing_statuses:
    errors.append(f"  [ERROR] Estados de contingencia faltantes: {missing_statuses}")
    print(f"  FAIL estados: {missing_statuses}")
else:
    print(f"  OK estados: {sorted(cont_statuses)}")
if missing_sev:
    errors.append(f"  [ERROR] Severidad 'low' faltante en contingencias")
    print(f"  FAIL severidad: falta 'low'")
else:
    print(f"  OK severidades: {sorted(cont_severities)}")

# F. HITL con decision=correct
print("\n[F] HITL con decision=correct:")
hitl_correct = [r for r in hitl if r.get("decision","") == "correct"]
if not hitl_correct:
    errors.append("  [ERROR] No hay decisiones HITL con decision=correct")
    print(f"  FAIL: No se encontro ninguna")
else:
    print(f"  OK - {len(hitl_correct)} decisiones con decision=correct")

# G. War Room con decision_type=transfer
print("\n[G] War Room con decision_type=transfer:")
war_transfer = [r for r in war_decisions if r.get("decision_type","") == "transfer"]
if not war_transfer:
    errors.append("  [ERROR] No hay decisiones War Room con decision_type=transfer")
    print(f"  FAIL: No se encontro ninguna")
else:
    print(f"  OK - {len(war_transfer)} decisiones con decision_type=transfer")

# H. Roles con is_active=false y expires_at vencido
print("\n[H] Roles RBAC: is_active=false y expires_at vencido:")
inactive_roles = [r for r in roles if r.get("is_active","").lower() == "false"]
expired_roles = [r for r in roles if r.get("expires_at","").strip() and r.get("expires_at","") < "2026-02-23"]
if len(inactive_roles) < 2:
    errors.append(f"  [ERROR] Solo {len(inactive_roles)} roles con is_active=false (minimo 2)")
    print(f"  FAIL: Solo {len(inactive_roles)} roles inactivos")
else:
    print(f"  OK - {len(inactive_roles)} roles con is_active=false: {[r['user_email'] for r in inactive_roles]}")
if len(expired_roles) < 2:
    errors.append(f"  [ERROR] Solo {len(expired_roles)} roles con expires_at vencido (minimo 2)")
    print(f"  FAIL: Solo {len(expired_roles)} roles con expires_at vencido")
else:
    print(f"  OK - {len(expired_roles)} roles con expires_at vencido: {[r['user_email'] for r in expired_roles]}")

# I. VDR con archived, superseded, error y link expirado
print("\n[I] VDR: archived, superseded, error y link expirado:")
vdr_statuses = set(r.get("status","") for r in vdr_docs)
missing_vdr = {"archived","superseded","error"} - vdr_statuses
expired_links = [r for r in vdr_docs if r.get("link_expires_at","").strip() and r.get("link_expires_at","") < "2026-02-23"]
if missing_vdr:
    errors.append(f"  [ERROR] Estados VDR faltantes: {missing_vdr}")
    print(f"  FAIL: Faltantes: {missing_vdr}")
else:
    print(f"  OK - Statuses VDR: {sorted(vdr_statuses)}")
if len(expired_links) < 1:
    errors.append("  [ERROR] No hay documentos VDR con link expirado")
    print(f"  FAIL: No hay links expirados")
else:
    print(f"  OK - {len(expired_links)} documentos con link expirado")

# J. QA threads con due_at pasado (overdue real)
print("\n[J] QA threads con due_at pasado (overdue real, antes de 2026-02-23):")
overdue_threads = [r for r in qa_threads if r.get("due_at","").strip() and r.get("due_at","") < "2026-02-23T00:00:00Z"]
if len(overdue_threads) < 2:
    errors.append(f"  [ERROR] Solo {len(overdue_threads)} hilos QA con due_at pasado (minimo 2)")
    print(f"  FAIL: Solo {len(overdue_threads)} hilos overdue")
else:
    print(f"  OK - {len(overdue_threads)} hilos con due_at pasado:")
    for t in overdue_threads:
        print(f"    {t['thread_code']} due_at={t['due_at']}")

# Summary
print("\n" + "=" * 70)
print("RESUMEN DE VALIDACION")
print("=" * 70)

if errors:
    print(f"\n[ERRORES] {len(errors)} errores encontrados:")
    for e in errors:
        print(e)
else:
    print(f"\n[OK] Sin errores criticos")

print(f"\n{'='*70}")
print(f"RESULTADO FINAL: {'PASS' if not errors else 'FAIL'}")
print(f"{'='*70}")

# Final stats
total = sum([len(projects), len(roles), len(tasks), len(contingencies),
             len(cont_ext), len(clause_map), len(vdr_docs), len(qa_threads),
             len(qa_messages), len(hitl), len(reports), len(war_decisions),
             len(war_notifications), len(risk_scores), len(evidence), len(workflows)])
print(f"\nESTADISTICAS DEL DATASET v3:")
print(f"  Proyectos:              {len(projects):4d}")
print(f"  Roles:                  {len(roles):4d}  (incl. {len(inactive_roles)} inactivos, {len(expired_roles)} expirados)")
print(f"  Tareas Kanban:          {len(tasks):4d}")
print(f"  Contingencias:          {len(contingencies):4d}  (incl. mitigated/resolved/accepted/low)")
print(f"  Contingencias ext:      {len(cont_ext):4d}")
print(f"  Mapeo clausulas SPA:    {len(clause_map):4d}")
print(f"  Documentos VDR:         {len(vdr_docs):4d}  (incl. archived/superseded/error/link_expirado)")
print(f"  Hilos QA:               {len(qa_threads):4d}  (incl. {len(overdue_threads)} overdue reales)")
print(f"  Mensajes QA:            {len(qa_messages):4d}")
print(f"  Decisiones HITL:        {len(hitl):4d}  (incl. decision=correct)")
print(f"  Reportes:               {len(reports):4d}  (incl. client y counterparty)")
print(f"  Decisiones War Room:    {len(war_decisions):4d}  (incl. decision_type=transfer)")
print(f"  Notificaciones WR:      {len(war_notifications):4d}")
print(f"  Scores de riesgo:       {len(risk_scores):4d}")
print(f"  Evidencias:             {len(evidence):4d}")
print(f"  Instancias workflow:    {len(workflows):4d}  (incl. created/paused/completed/cancelled)")
print(f"  {'─'*30}")
print(f"  TOTAL:                  {total:4d} filas")

sys.exit(0 if not errors else 1)
