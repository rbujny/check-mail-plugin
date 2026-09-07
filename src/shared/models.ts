import { runtimeModelValues, type RuntimeModel } from '../types/email';

export const STORAGE_KEY_SELECTED_MODEL = 'checkmail_selected_model';

export type SelectedModelId = 'default' | RuntimeModel;

export interface ModelOptionDefinition {
    id: SelectedModelId;
    backendModel?: RuntimeModel;
    nameKey: string;
    descriptionKey: string;
    badgeKey?: string;
    badgeType?: 'auto' | 'speed' | 'smart';
    isRecommended?: boolean;
}

export const AVAILABLE_MODEL_OPTIONS: ModelOptionDefinition[] = [
    {
        id: 'default',
        nameKey: 'modelOptionDefaultName',
        descriptionKey: 'modelOptionDefaultDesc',
        badgeKey: 'modelOptionDefaultBadge',
        badgeType: 'auto',
        isRecommended: true,
    },
    {
        id: 'gemini-3.5-flash-lite',
        backendModel: 'gemini-3.5-flash-lite',
        nameKey: 'modelOptionFlashLiteName',
        descriptionKey: 'modelOptionFlashLiteDesc',
        badgeKey: 'modelOptionFlashLiteBadge',
        badgeType: 'speed',
    },
    {
        id: 'gemini-3.7-flash',
        backendModel: 'gemini-3.7-flash',
        nameKey: 'modelOptionFlashName',
        descriptionKey: 'modelOptionFlashDesc',
        badgeKey: 'modelOptionFlashBadge',
        badgeType: 'smart',
    },
];



export function isValidRuntimeModel(value: unknown): value is RuntimeModel {
    return typeof value === 'string' && runtimeModelValues.includes(value as RuntimeModel);
}

export function normalizeSelectedModel(value: unknown): SelectedModelId {
    if (isValidRuntimeModel(value)) {
        return value;
    }
    return 'default';
}

export async function getSelectedModel(): Promise<SelectedModelId> {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const data = await chrome.storage.local.get(STORAGE_KEY_SELECTED_MODEL);
            return normalizeSelectedModel(data[STORAGE_KEY_SELECTED_MODEL]);
        }
    } catch (err) {
        console.warn('[CheckMail] Failed to get selected model from storage:', err);
    }
    return 'default';
}

export async function setSelectedModel(modelId: SelectedModelId): Promise<void> {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ [STORAGE_KEY_SELECTED_MODEL]: modelId });
        }
    } catch (err) {
        console.error('[CheckMail] Failed to save selected model to storage:', err);
        throw err;
    }
}
