import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AVAILABLE_MODEL_OPTIONS,
    STORAGE_KEY_SELECTED_MODEL,
    getSelectedModel,
    isValidRuntimeModel,
    normalizeSelectedModel,
    setSelectedModel,
} from '../models';

describe('models shared module', () => {
    beforeEach(() => {
        vi.stubGlobal('chrome', {
            storage: {
                local: {
                    get: vi.fn(),
                    set: vi.fn(),
                },
            },
        });
    });

    describe('AVAILABLE_MODEL_OPTIONS', () => {
        it('should define exactly the supported model options', () => {
            const ids = AVAILABLE_MODEL_OPTIONS.map((opt) => opt.id);
            expect(ids).toEqual(['default', 'gemini-3.5-flash-lite', 'gemini-3.7-flash']);
        });

        it('should have default option marked as recommended', () => {
            const defaultOpt = AVAILABLE_MODEL_OPTIONS.find((opt) => opt.id === 'default');
            expect(defaultOpt?.isRecommended).toBe(true);
        });

        it('should define badgeKey and badgeType for all options', () => {
            for (const opt of AVAILABLE_MODEL_OPTIONS) {
                expect(opt.badgeKey).toBeDefined();
                expect(opt.badgeType).toBeDefined();
            }
        });
    });



    describe('isValidRuntimeModel', () => {
        it('should validate allowed runtime models', () => {
            expect(isValidRuntimeModel('gemini-3.5-flash-lite')).toBe(true);
            expect(isValidRuntimeModel('gemini-3.7-flash')).toBe(true);
        });

        it('should reject invalid or benchmark-only model names', () => {
            expect(isValidRuntimeModel('default')).toBe(false);
            expect(isValidRuntimeModel('gemma-4-26b-a4b-thinking-rag-v1')).toBe(false);
            expect(isValidRuntimeModel('gemma-4-26b-a4b')).toBe(false);
            expect(isValidRuntimeModel('')).toBe(false);
            expect(isValidRuntimeModel(null)).toBe(false);
            expect(isValidRuntimeModel(undefined)).toBe(false);
            expect(isValidRuntimeModel(123)).toBe(false);
        });
    });

    describe('normalizeSelectedModel', () => {
        it('should return valid runtime models unchanged', () => {
            expect(normalizeSelectedModel('gemini-3.5-flash-lite')).toBe('gemini-3.5-flash-lite');
            expect(normalizeSelectedModel('gemini-3.7-flash')).toBe('gemini-3.7-flash');
        });

        it('should fallback to default for unknown or invalid inputs', () => {
            expect(normalizeSelectedModel('unknown-model')).toBe('default');
            expect(normalizeSelectedModel(null)).toBe('default');
            expect(normalizeSelectedModel(undefined)).toBe('default');
            expect(normalizeSelectedModel('')).toBe('default');
        });
    });

    describe('getSelectedModel and setSelectedModel', () => {
        it('should get model from chrome storage', async () => {
            (chrome.storage.local.get as any).mockResolvedValueOnce({
                [STORAGE_KEY_SELECTED_MODEL]: 'gemini-3.7-flash',
            });

            const model = await getSelectedModel();
            expect(model).toBe('gemini-3.7-flash');
            expect(chrome.storage.local.get).toHaveBeenCalledWith(STORAGE_KEY_SELECTED_MODEL);
        });

        it('should fallback to default when storage has empty or missing value', async () => {
            (chrome.storage.local.get as any).mockResolvedValueOnce({});

            const model = await getSelectedModel();
            expect(model).toBe('default');
        });


        it('should set model into chrome storage', async () => {
            await setSelectedModel('gemini-3.5-flash-lite');

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                [STORAGE_KEY_SELECTED_MODEL]: 'gemini-3.5-flash-lite',
            });
        });
    });
});
