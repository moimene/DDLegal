# Design: Close PRD v3.0 Technical Gaps — 1 Week Sprint

**Date:** 2026-02-22
**Approach:** Enfoque A (por Slice), ejecutado con Claude Code agentes paralelos
**Goal:** Llevar Strangler Slices de ~72% a ~95% de completitud PRD

## Current State

| Slice | Current | Target | Key Gaps |
|-------|---------|--------|----------|
| S0 Gateway | 85% | 95% | Vault RAG, p95 real-time metrics |
| S2 Kanban | 75% | 95% | 10 estados UI, DoR/DoD, export, aging alerts |
| S3 Workflows | 50% | 90% | Workflows 1,4,6; activate CONT/LAB/FISC skills |
| S5 Observability | 55% | 90% | Harvey audit ingest, Usage/Query split, sync alerts |
| S6 War Room | 85% | 95% | Severity change notifications |

## 5-Day Execution Plan

### Day 1: S3 Workflows + S5 Observability (parallel)
- Track A: Activate CONT/LAB/FISC skills, implement Workflows 4+6
- Track B: Harvey audit log ingest, Usage/Query split, sync alerts, SLO panel with real data

### Day 2: S3 Workflow 1 + S0 Vault + S2 Kanban (3 parallel tracks)
- Track A: Workflow 1 (Arranque DD + backlog generation)
- Track B: Vault RAG endpoint + p95 metrics
- Track C: Kanban 10 states, DoR/DoD UI, export, aging alerts

### Day 3: S6 Notifications + Quick Wins
- Track A: War Room severity change notifications
- Track B: Evidence Pack v2 (finding→chunk linking), VDR→Vault sync

### Day 4: E2E Testing + Integration
- New tests for all Day 1-3 changes
- End-to-end flow verification

### Day 5: Hardening + Documentation
- Fix issues, clean build, update CLAUDE.md + PRD.md, commit

## Dependencies
- Harvey API credentials: AVAILABLE ✅
- All slices deployed: YES ✅
- No external blockers identified

## Success Criteria
- All 7 slices at ≥90% PRD completeness
- Build passes
- E2E tests pass for new functionality
- PRD.md and CLAUDE.md reflect actual state
