import { describe, expect, it } from 'vitest';
import { MODE_EMPTY, MODE_PLACEHOLDERS, MODE_STARTERS, modePlaceholder } from './modePresets';

const modes = ['chat', 'presentation', 'class', 'meeting'] as const;

describe('modePresets', () => {
    it('define atalhos distintos para cada modo', () => {
        const labels = modes.flatMap((mode) => MODE_STARTERS[mode].map((s) => s.label));
        expect(new Set(labels).size).toBe(labels.length);
        expect(MODE_STARTERS.presentation.some((s) => /roteiro/i.test(s.label))).toBe(true);
        expect(MODE_STARTERS.class.some((s) => /aula/i.test(s.label))).toBe(true);
        expect(MODE_STARTERS.meeting.some((s) => /síntese/i.test(s.label))).toBe(true);
    });

    it('tem placeholder e estado vazio por modo', () => {
        for (const mode of modes) {
            expect(MODE_PLACEHOLDERS[mode].length).toBeGreaterThan(10);
            expect(MODE_EMPTY[mode].length).toBeGreaterThan(20);
            expect(MODE_STARTERS[mode].length).toBeGreaterThanOrEqual(2);
        }
        expect(modePlaceholder('chat', false)).toBe('Representante inativo');
        expect(modePlaceholder('presentation', true)).toBe(MODE_PLACEHOLDERS.presentation);
    });
});
