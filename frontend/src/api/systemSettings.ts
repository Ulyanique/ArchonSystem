import type { SystemSettings } from '../types';
import { api } from './client';

export const systemSettingsApi = {
  get: (): Promise<SystemSettings> => api.get('/system/settings').then((r) => r.data),
  update: (data: Partial<SystemSettings>): Promise<SystemSettings> =>
    api.put('/system/settings', data).then((r) => r.data),
  getPromptDefaults: (): Promise<unknown> => api.get('/system/settings/prompt/defaults').then((r) => r.data),
  validatePromptSettings: (settings: unknown): Promise<{ valid: boolean; message: string }> =>
    api.post('/system/settings/prompt/validate', settings).then((r) => r.data),
};
