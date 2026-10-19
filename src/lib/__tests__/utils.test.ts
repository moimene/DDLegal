import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDate, formatCurrency } from '../utils';

describe('formatDate', () => {
    it('returns em-dash for null date', () => {
        expect(formatDate(null)).toBe('—');
    });

    it('formats date correctly', () => {
        // Date format string matching /15\s+ene\.?\s+2024/
        const result = formatDate('2024-01-15T00:00:00.000Z');
        expect(result).toMatch(/15\s+ene\.?\s+2024/i);
    });
});

describe('formatCurrency', () => {
    it('returns em-dash for null amount', () => {
        expect(formatCurrency(null)).toBe('—');
    });

    it('formats currency correctly', () => {
        const result = formatCurrency(1234.56, 'EUR');
        expect(result).toMatch(/1\.?235\s*€/);
    });
});
