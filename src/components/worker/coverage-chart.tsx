'use client';

/**
 * CoverageChart — Coverage visualization for DD Worker
 *
 * Displays:
 * - Overall coverage percentage with progress bar
 * - Per-area coverage in a grid layout
 */

import type { CoverageSnapshot } from '@/lib/worker/worker-controller';

// ============================================================================
// Area Color Configuration
// ============================================================================

const AREA_COLORS: Record<string, string> = {
  MERC: '#004438', // Brand color
  CONT: '#2563eb', // Blue
  FISC: '#7c3aed', // Violet
  LAB: '#db2777',  // Pink
  PI: '#ea580c',   // Orange
  LIT: '#dc2626',  // Red
  ADM: '#65a30d',  // Lime
};

const AREA_NAMES: Record<string, string> = {
  MERC: 'Mercantil',
  CONT: 'Contractual',
  FISC: 'Fiscal',
  LAB: 'Laboral',
  PI: 'Propiedad Intelectual',
  LIT: 'Litigios',
  ADM: 'Administrativo',
};

// ============================================================================
// Helpers
// ============================================================================

function getOverallBarColor(percentage: number): string {
  if (percentage >= 80) return 'var(--status-success)';
  if (percentage >= 60) return 'var(--status-warning)';
  return 'var(--status-error)';
}

function getAreaColor(code: string): string {
  return AREA_COLORS[code] || 'var(--g-text-secondary)';
}

function getAreaName(code: string): string {
  return AREA_NAMES[code] || code;
}

// ============================================================================
// Component Props
// ============================================================================

interface CoverageChartProps {
  coverage: CoverageSnapshot;
  className?: string;
}

// ============================================================================
// CoverageChart Component
// ============================================================================

export function CoverageChart({ coverage, className = '' }: CoverageChartProps) {
  const overallPercentage = Math.round(coverage.overall);
  const overallColor = getOverallBarColor(overallPercentage);
  const areaEntries = Object.entries(coverage.by_area).sort(
    (a, b) => b[1] - a[1] // Sort by coverage descending
  );

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--g-surface-card)',
        borderRadius: 'var(--g-radius-lg)',
        border: '1px solid var(--g-border-default)',
        padding: 'var(--g-space-5)',
      }}
    >
      {/* Overall Coverage */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--g-text-primary)' }}>
            Cobertura General
          </span>
          <span className="text-lg font-bold" style={{ color: overallColor }}>
            {overallPercentage}%
          </span>
        </div>

        {/* Overall Progress Bar */}
        <div
          className="w-full h-3"
          style={{
            borderRadius: 'var(--g-radius-full)',
            backgroundColor: 'var(--g-surface-muted)',
          }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(overallPercentage, 100)}%`,
              borderRadius: 'var(--g-radius-full)',
              backgroundColor: overallColor,
            }}
          />
        </div>

        {/* Coverage Legend */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2"
              style={{ borderRadius: '50%', backgroundColor: 'var(--status-success)' }}
            />
            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
              80%+
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2"
              style={{ borderRadius: '50%', backgroundColor: 'var(--status-warning)' }}
            />
            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
              60-79%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2"
              style={{ borderRadius: '50%', backgroundColor: 'var(--status-error)' }}
            />
            <span className="text-xs" style={{ color: 'var(--g-text-secondary)' }}>
              &lt;60%
            </span>
          </div>
        </div>
      </div>

      {/* Per-Area Coverage Grid */}
      {areaEntries.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--g-text-secondary)' }}>
              Cobertura por Area
            </span>
            <span className="text-xs" style={{ color: 'var(--g-text-muted)' }}>
              {areaEntries.length} areas
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {areaEntries.map(([code, percentage]) => {
              const pct = Math.round(percentage);
              const color = getAreaColor(code);
              const barColor = getOverallBarColor(pct);

              return (
                <div
                  key={code}
                  className="p-3"
                  style={{
                    borderRadius: 'var(--g-radius-md)',
                    border: '1px solid var(--g-border-default)',
                    borderLeft: `3px solid ${color}`,
                    backgroundColor: 'var(--g-surface-card)',
                  }}
                >
                  {/* Area Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5"
                      style={{
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: `${color}1a`, // 10% opacity
                        color: color,
                      }}
                    >
                      {code}
                    </span>
                    <span className="text-sm font-bold" style={{ color: barColor }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Area Name */}
                  <p
                    className="text-xs font-medium mb-2 truncate"
                    style={{ color: 'var(--g-text-primary)' }}
                    title={getAreaName(code)}
                  >
                    {getAreaName(code)}
                  </p>

                  {/* Area Progress Bar */}
                  <div
                    className="w-full h-1.5"
                    style={{
                      borderRadius: 'var(--g-radius-full)',
                      backgroundColor: 'var(--g-surface-muted)',
                    }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        borderRadius: 'var(--g-radius-full)',
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>
            No hay datos de cobertura por area disponibles
          </p>
        </div>
      )}
    </div>
  );
}

export default CoverageChart;
