import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { universesApi } from '../api';

interface UniverseClockProps {
  universeId: number;
}

export default function UniverseClock({ universeId }: UniverseClockProps) {
  const { data: universe } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(universeId),
    enabled: !!universeId,
  });

  const clockEnabled = universe?.clock_enabled === true || universe?.clock_enabled === 1;
  
  const { data: currentTime, isLoading: isLoadingTime, error: timeError } = useQuery({
    queryKey: ['universe-clock', universeId],
    queryFn: () => universesApi.getClock(universeId),
    enabled: !!universeId,
    refetchInterval: clockEnabled ? 60_000 : false, // Обновляем каждую минуту для синхронизации
    retry: 1,
  });

  // Локальное состояние для плавного обновления секунд
  const [localTime, setLocalTime] = useState<{ year: number; day: number; hour: number; minute: number; second: number; epoch: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  useEffect(() => {
    if (currentTime) {
      setLocalTime(currentTime);
      setLastSyncTime(Date.now());
    }
  }, [currentTime]);

  // Обновляем секунды локально каждую секунду
  useEffect(() => {
    if (!universe || !localTime) return;

    const interval = setInterval(() => {
      setLocalTime(prev => {
        if (!prev) return null;
        
        // Вычисляем прошедшие секунды с последней синхронизации
        const elapsedSeconds = Math.floor((Date.now() - lastSyncTime) / 1000);
        
        // Если прошло больше 60 секунд, лучше подождать следующей синхронизации от API
        if (elapsedSeconds > 60) {
          return prev;
        }
        
        let newSecond = prev.second + 1;
        let newMinute = prev.minute;
        let newHour = prev.hour;
        let newDay = prev.day;
        let newYear = prev.year;

        const hoursPerDay = universe.universe_hours_per_day || 24;
        const daysPerYear = universe.universe_days_per_year || 365;

        if (newSecond >= 60) {
          newSecond = 0;
          newMinute += 1;
        }
        if (newMinute >= 60) {
          newMinute = 0;
          newHour += 1;
        }
        if (newHour >= hoursPerDay) {
          newHour = 0;
          newDay += 1;
        }
        if (newDay > daysPerYear) {
          newDay = 1;
          newYear += 1;
        }

        return {
          ...prev,
          second: newSecond,
          minute: newMinute,
          hour: newHour,
          day: newDay,
          year: newYear,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [universe, localTime, lastSyncTime, universe?.universe_hours_per_day, universe?.universe_days_per_year]);

  if (!localTime) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock size={14} />
        <span>{isLoadingTime ? 'Загрузка...' : timeError ? 'Ошибка' : '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      <Clock size={14} className="text-gray-500" />
      <span>
        <span className="font-medium">{localTime.year}</span>
        <span className="text-gray-500"> {localTime.epoch}</span>
        {' · '}
        <span className="font-medium">День {localTime.day}</span>
        {' · '}
        <span className="font-medium">
          {String(localTime.hour).padStart(2, '0')}:
          {String(localTime.minute).padStart(2, '0')}:
          {String(localTime.second).padStart(2, '0')}
        </span>
      </span>
    </div>
  );
}
