import { describe, expect, it } from 'vitest';
import {
  buildHarveyWorkflowPrompt,
  buildN8nExecutionPayload,
  extractIterationContext,
} from '../prompt-builder';

describe('workflows/prompt-builder', () => {
  it('extracts nested iteration context and keeps only recent loops', () => {
    const context = extractIterationContext({
      workflow_phase: 'analisis',
      workflow_iteration: {
        workflow_instance_id: 'wf-123',
        workflow_phase: 'valoracion',
        loop_number: 4,
        phase_loop_number: 2,
        previous_loops: [
          { loop_number: 1, phase: 'obtencion' },
          { loop_number: 2, phase: 'gestion' },
          { loop_number: 3, phase: 'analisis' },
          { loop_number: 4, phase: 'valoracion' },
        ],
      },
    });

    expect(context.workflow_instance_id).toBe('wf-123');
    expect(context.workflow_phase).toBe('valoracion');
    expect(context.loop_number).toBe(4);
    expect(context.phase_loop_number).toBe(2);
    expect(context.previous_loops).toHaveLength(3);
    expect(context.previous_loops?.[0].loop_number).toBe(2);
  });

  it('builds a Harvey prompt enriched with skill and iteration context', () => {
    const prompt = buildHarveyWorkflowPrompt({
      workflow_key: 'wf_04_cont_material_contracts',
      project_id: 'project-1',
      phase: 'analisis',
      input: {
        project_id: 'project-1',
        workflow_iteration: {
          workflow_instance_id: 'instance-77',
          loop_number: 3,
          phase_loop_number: 2,
        },
        contracts_count: 15,
      },
      skills: [
        {
          skill_key: 'cont_extractor_clausulas',
          prompt_template: 'Extrae clausulas sensibles de control.',
          expected_output_schema: { findings: [] },
          evidence_requirements: { min_refs: 2 },
        },
      ],
    });

    expect(prompt).toContain('WORKFLOW CONTEXT');
    expect(prompt).toContain('workflow_key: wf_04_cont_material_contracts');
    expect(prompt).toContain('loop_number: 3');
    expect(prompt).toContain('phase_loop_number: 2');
    expect(prompt).toContain('[SKILL 1] cont_extractor_clausulas');
    expect(prompt).toContain('Extrae clausulas sensibles de control.');
    expect(prompt).toContain('"contracts_count": 15');
    expect(prompt).not.toContain('"workflow_iteration"');
  });

  it('builds n8n payload with skill metadata and workflow_iteration envelope', () => {
    const payload = buildN8nExecutionPayload({
      workflow_key: 'societario',
      project_id: 'project-2',
      phase: 'analisis',
      input: {
        cif: 'A00000000',
        workflow_instance_id: 'instance-9',
        workflow_phase: 'analisis',
        workflow_iteration: {
          loop_number: 2,
          phase_loop_number: 1,
        },
      },
      skills: [
        {
          skill_key: 'societario.consulta_borme',
          prompt_template: 'Consultar BORME',
          expected_output_schema: { report_section: 'string' },
        },
        {
          skill_key: 'societario.analisis_organos',
          prompt_template: 'Analizar organos',
          evidence_requirements: { mandatory: true },
        },
      ],
    });

    expect(payload.workflow_key).toBe('societario');
    expect(payload.project_id).toBe('project-2');
    expect(payload.skill_keys).toEqual([
      'societario.consulta_borme',
      'societario.analisis_organos',
    ]);
    expect(payload.skills).toHaveLength(2);
    expect(payload.workflow_iteration).toEqual({
      workflow_instance_id: 'instance-9',
      workflow_phase: 'analisis',
      loop_number: 2,
      phase_loop_number: 1,
      previous_loops: [],
    });
    expect(payload).not.toHaveProperty('workflow_iteration.workflow_iteration');
  });
});
