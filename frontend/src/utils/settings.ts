// src/utils/settings.ts
import { useState, useEffect } from 'react';
import { storage } from './storage';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  aiProvider: 'ollama' | 'deepseek';
  aiModel: string;
  sidebarCollapsed: boolean;
  defaultUniverseId: number | null;
  chatAutoScroll: boolean; // новая настройка для чата
}

const SETTINGS_KEY = 'app-settings';
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  aiProvider: 'ollama',
  aiModel: 'deepseek-v3.1:671b-cloud',
  sidebarCollapsed: false,
  defaultUniverseId: null,
  chatAutoScroll: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    return storage.get<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  });

  useEffect(() => {
    storage.set(SETTINGS_KEY, settings);
  }, [settings]);

  const update = (partial: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  return { settings, update };
}