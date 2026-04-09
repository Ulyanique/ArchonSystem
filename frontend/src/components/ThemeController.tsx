import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { systemSettingsApi } from '../api';

const ACCENT_VALUES = ['green', 'blue', 'purple', 'orange', 'cyan'] as const;

export default function ThemeController() {
  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.get,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (settings?.theme) {
      root.dataset.theme = settings.theme;
    }
    const accent = settings?.accent_color;
    if (accent && ACCENT_VALUES.includes(accent as typeof ACCENT_VALUES[number])) {
      root.dataset.accent = accent;
    } else {
      root.dataset.accent = 'green';
    }
  }, [settings?.theme, settings?.accent_color]);

  return null;
}
