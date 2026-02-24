/**
 * Dependency Resolver — Worker Architecture v1.0
 *
 * Responsibility: Resolve FO dependencies and order evaluation waves.
 *
 * Some Finding Objectives have logical dependencies:
 * - FO-MERC-002 (Estatutos) depends on FO-MERC-001 (Escritura constitución)
 * - FO-CONT-002 (Cláusulas CoC) depends on FO-CONT-001 (Contratos materiales)
 *
 * The resolver performs topological sort to determine evaluation order,
 * grouping independent FOs into "waves" that can be evaluated in parallel.
 */

import type { FindingObjective } from '@/lib/findings/objective-types';

// ============================================================================
// Types
// ============================================================================

export interface DependencyGraph {
  nodes: Map<string, FindingObjective>;
  edges: Map<string, Set<string>>; // FO key → set of dependency keys
}

export interface EvaluationWave {
  waveNumber: number;
  objectives: FindingObjective[];
  dependsOnWaves: number[];
}

export interface ResolutionResult {
  waves: EvaluationWave[];
  totalObjectives: number;
  hasCircularDependencies: boolean;
  circularDependencyChain?: string[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Resolve evaluation order for a set of Finding Objectives.
 *
 * Returns "waves" of FOs that can execute in parallel:
 * - Wave 0: FOs with no dependencies
 * - Wave 1: FOs that depend only on Wave 0
 * - Wave N: FOs that depend on Wave N-1 or earlier
 *
 * @param objectives Array of applicable Finding Objectives
 * @returns ResolutionResult with ordered waves
 */
export function resolveEvaluationOrder(
  objectives: FindingObjective[]
): ResolutionResult {
  if (objectives.length === 0) {
    return {
      waves: [],
      totalObjectives: 0,
      hasCircularDependencies: false,
    };
  }

  // Build dependency graph
  const graph = buildDependencyGraph(objectives);

  // Detect circular dependencies
  const circularChain = detectCircularDependencies(graph);
  if (circularChain) {
    console.warn('[dependency-resolver] Circular dependency detected:', circularChain);
    // Still continue, but put remaining in final wave
  }

  // Perform topological sort into waves
  const waves = topologicalSort(graph);

  return {
    waves,
    totalObjectives: objectives.length,
    hasCircularDependencies: circularChain !== null,
    circularDependencyChain: circularChain ?? undefined,
  };
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build a dependency graph from the set of objectives.
 */
function buildDependencyGraph(objectives: FindingObjective[]): DependencyGraph {
  const nodes = new Map<string, FindingObjective>();
  const edges = new Map<string, Set<string>>();

  // Index all objectives by key
  for (const fo of objectives) {
    nodes.set(fo.objective_key, fo);
    edges.set(fo.objective_key, new Set());
  }

  // Build edges from depends_on
  for (const fo of objectives) {
    const dependencies = fo.depends_on || [];
    for (const depKey of dependencies) {
      // Only add edge if dependency is in our set
      if (nodes.has(depKey)) {
        edges.get(fo.objective_key)!.add(depKey);
      }
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Circular Dependency Detection
// ============================================================================

/**
 * Detect circular dependencies using DFS.
 * Returns the cycle chain if found, null otherwise.
 */
function detectCircularDependencies(graph: DependencyGraph): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeKey: string): string[] | null {
    if (recursionStack.has(nodeKey)) {
      // Found cycle - extract the cycle path
      const cycleStart = path.indexOf(nodeKey);
      return [...path.slice(cycleStart), nodeKey];
    }

    if (visited.has(nodeKey)) {
      return null;
    }

    visited.add(nodeKey);
    recursionStack.add(nodeKey);
    path.push(nodeKey);

    const dependencies = graph.edges.get(nodeKey) || new Set();
    for (const depKey of Array.from(dependencies)) {
      const cycle = dfs(depKey);
      if (cycle) return cycle;
    }

    path.pop();
    recursionStack.delete(nodeKey);
    return null;
  }

  for (const nodeKey of Array.from(graph.nodes.keys())) {
    const cycle = dfs(nodeKey);
    if (cycle) return cycle;
  }

  return null;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Perform topological sort, grouping FOs into evaluation waves.
 * Uses Kahn's algorithm adapted for wave generation.
 */
function topologicalSort(graph: DependencyGraph): EvaluationWave[] {
  const waves: EvaluationWave[] = [];
  const resolved = new Set<string>();
  const remaining = new Set(Array.from(graph.nodes.keys()));

  let waveNumber = 0;

  while (remaining.size > 0) {
    // Find all FOs whose dependencies are all resolved
    const waveObjectives: FindingObjective[] = [];
    const dependsOnWaves: Set<number> = new Set();

    for (const key of Array.from(remaining)) {
      const dependencies = graph.edges.get(key) || new Set();
      const unresolvedDeps = Array.from(dependencies).filter(dep => !resolved.has(dep));

      if (unresolvedDeps.length === 0) {
        // All dependencies resolved, can add to this wave
        const fo = graph.nodes.get(key)!;
        waveObjectives.push(fo);

        // Track which waves we depend on
        for (const dep of Array.from(dependencies)) {
          const depWave = findWaveForObjective(waves, dep);
          if (depWave !== -1) {
            dependsOnWaves.add(depWave);
          }
        }
      }
    }

    if (waveObjectives.length === 0) {
      // No progress - remaining have circular dependencies
      // Add all remaining to final wave with warning
      console.warn(
        '[dependency-resolver] Could not resolve remaining FOs, adding to final wave:',
        Array.from(remaining)
      );

      const remainingObjectives = Array.from(remaining)
        .map(key => graph.nodes.get(key)!)
        .filter(Boolean);

      if (remainingObjectives.length > 0) {
        waves.push({
          waveNumber,
          objectives: remainingObjectives,
          dependsOnWaves: waveNumber > 0 ? [waveNumber - 1] : [],
        });
      }
      break;
    }

    // Create wave
    waves.push({
      waveNumber,
      objectives: waveObjectives,
      dependsOnWaves: Array.from(dependsOnWaves).sort((a, b) => a - b),
    });

    // Mark as resolved and remove from remaining
    for (const fo of waveObjectives) {
      resolved.add(fo.objective_key);
      remaining.delete(fo.objective_key);
    }

    waveNumber++;
  }

  return waves;
}

/**
 * Find which wave number contains a given objective key.
 */
function findWaveForObjective(waves: EvaluationWave[], objectiveKey: string): number {
  for (const wave of waves) {
    if (wave.objectives.some(fo => fo.objective_key === objectiveKey)) {
      return wave.waveNumber;
    }
  }
  return -1;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all FOs that depend on a given FO (reverse dependencies).
 * Useful for invalidation when a finding changes.
 */
export function getDependents(
  objectiveKey: string,
  allObjectives: FindingObjective[]
): FindingObjective[] {
  return allObjectives.filter(fo => {
    const deps = fo.depends_on || [];
    return deps.includes(objectiveKey);
  });
}

/**
 * Check if all dependencies of an FO have been evaluated.
 */
export function areDependenciesResolved(
  fo: FindingObjective,
  resolvedKeys: Set<string>
): boolean {
  const dependencies = fo.depends_on || [];
  return dependencies.every(depKey => resolvedKeys.has(depKey));
}

/**
 * Get the maximum depth of the dependency chain for an FO.
 * Useful for understanding evaluation complexity.
 */
export function getMaxDependencyDepth(
  objectiveKey: string,
  allObjectives: FindingObjective[],
  visited = new Set<string>()
): number {
  if (visited.has(objectiveKey)) {
    return 0; // Circular, stop
  }

  const fo = allObjectives.find(o => o.objective_key === objectiveKey);
  if (!fo) return 0;

  const dependencies = fo.depends_on || [];
  if (dependencies.length === 0) return 0;

  visited.add(objectiveKey);

  let maxDepth = 0;
  for (const depKey of dependencies) {
    const depth = getMaxDependencyDepth(depKey, allObjectives, visited);
    maxDepth = Math.max(maxDepth, depth + 1);
  }

  return maxDepth;
}
