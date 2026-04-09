import { useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { setOnNetworkError } from '../api/client';
import { systemSettingsApi } from '../api';

const POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;

export default function ToastContainer() {
  useEffect(() => {
    setOnNetworkError((message) => toast.error(message));
    return () => setOnNetworkError(null);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.get,
    staleTime: 5 * 60 * 1000,
  });

  const show = settings?.show_toast_notifications !== false;
  const position = (settings?.toast_position && POSITIONS.includes(settings.toast_position as typeof POSITIONS[number]))
    ? (settings.toast_position as typeof POSITIONS[number])
    : 'bottom-center';
  const duration = typeof settings?.toast_duration === 'number' && settings.toast_duration >= 0
    ? settings.toast_duration
    : 3000;

  return (
    <div style={{ display: show ? 'block' : 'none' }} aria-hidden={!show}>
      <Toaster
        position={position}
        toastOptions={{
          duration: duration === 0 ? 2 * 60 * 60 * 1000 : duration,
          style: {
            minWidth: '420px',
            maxWidth: 'min(520px, 90vw)',
            background: 'rgba(15, 23, 42, 0.97)',
            color: '#f1f5f9',
            border: '1px solid var(--color-accent)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          },
          success: {
            style: {
              minWidth: '420px',
              maxWidth: 'min(520px, 90vw)',
              background: 'rgba(15, 23, 42, 0.97)',
              color: '#f1f5f9',
              border: '1px solid var(--color-accent)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            },
          },
          error: {
            style: {
              minWidth: '420px',
              maxWidth: 'min(520px, 90vw)',
              background: 'rgba(30, 15, 15, 0.97)',
              color: '#fecaca',
              border: '1px solid #ef4444',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            },
          },
          loading: {
            style: {
              minWidth: '420px',
              maxWidth: 'min(520px, 90vw)',
              background: 'rgba(15, 23, 42, 0.97)',
              color: '#f1f5f9',
              border: '1px solid var(--color-accent)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            },
          },
        }}
      />
    </div>
  );
}
