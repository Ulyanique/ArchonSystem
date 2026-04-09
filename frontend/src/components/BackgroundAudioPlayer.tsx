import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, SkipForward, Volume2, VolumeX, Music } from 'lucide-react';
import { universesApi } from '../api';

const FADE_IN_DURATION_MS = 2000;
const FADE_OUT_DURATION_MS = 3000;
const FADE_OUT_START_BEFORE_END_MS = 3000;

interface BackgroundAudioPlayerProps {
  universeId: number;
}

const STORAGE_KEY_PREFIX = 'audioPlayer_';

function loadAudioState(universeId: number): { volume: number; isPlaying: boolean; muted: boolean } {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${universeId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.5,
        isPlaying: typeof parsed.isPlaying === 'boolean' ? parsed.isPlaying : false,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      };
    }
  } catch (e) {
    console.warn('Failed to load audio state from localStorage', e);
  }
  return { volume: 0.5, isPlaying: false, muted: false };
}

function saveAudioState(universeId: number, state: { volume: number; isPlaying: boolean; muted: boolean }) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${universeId}`, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save audio state to localStorage', e);
  }
}

export default function BackgroundAudioPlayer({ universeId }: BackgroundAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialState = loadAudioState(universeId);
  const [isPlaying, setIsPlaying] = useState(initialState.isPlaying);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(initialState.volume);
  const [muted, setMuted] = useState(initialState.muted);

  const fadeRafId = useRef<number | null>(null);
  const isFadingRef = useRef(false);
  const autoplayDoneRef = useRef(false);
  const currentIndexRef = useRef(0);
  const tracksRef = useRef<{ url: string; name: string }[]>([]);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const skipNextLoadEffectRef = useRef(false);
  const initialIsPlayingRef = useRef(initialState.isPlaying);

  const { data: tracks = [] } = useQuery({
    queryKey: ['background-audio', universeId],
    queryFn: () => universesApi.getBackgroundAudio(universeId),
    enabled: !!universeId,
  });

  useEffect(() => {
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    autoplayDoneRef.current = false;
    lastLoadedUrlRef.current = null;
    // Загружаем сохраненное состояние при смене вселенной
    const savedState = loadAudioState(universeId);
    setVolume(savedState.volume);
    setMuted(savedState.muted);
    setIsPlaying(savedState.isPlaying);
    initialIsPlayingRef.current = savedState.isPlaying;
  }, [universeId]);

  // Сохраняем состояние при изменении
  useEffect(() => {
    saveAudioState(universeId, { volume, isPlaying, muted });
  }, [universeId, volume, isPlaying, muted]);

  currentIndexRef.current = currentIndex;
  tracksRef.current = tracks;
  const currentTrack = tracks.length > 0 ? tracks[currentIndex % tracks.length] : null;
  const targetVolume = muted ? 0 : volume;

  const playNext = useCallback(() => {
    const list = tracksRef.current;
    if (list.length === 0) return;
    const idx = currentIndexRef.current;
    let next = Math.floor(Math.random() * list.length);
    if (list.length > 1 && next === idx) {
      next = (next + 1) % list.length;
    }
    currentIndexRef.current = next;
    setCurrentIndex(next);
    const el = audioRef.current;
    if (el && list.length > 0) {
      const nextTrack = list[next];
      lastLoadedUrlRef.current = nextTrack.url;
      el.src = nextTrack.url;
      el.volume = 0;
      isFadingRef.current = true;
      el.play().catch(() => setIsPlaying(false));
    }
  }, []);

  const applyVolume = useCallback(
    (el: HTMLAudioElement) => {
      if (!isFadingRef.current) el.volume = Math.max(0, Math.min(1, targetVolume));
    },
    [targetVolume]
  );

  useEffect(() => {
    if (skipNextLoadEffectRef.current) {
      skipNextLoadEffectRef.current = false;
      return;
    }
    const el = audioRef.current;
    if (!el || !currentTrack) return;
    const url = currentTrack.url;
    const needLoad = lastLoadedUrlRef.current !== url;
    if (needLoad) {
      if (fadeRafId.current != null) {
        cancelAnimationFrame(fadeRafId.current);
        fadeRafId.current = null;
      }
      isFadingRef.current = false;
      lastLoadedUrlRef.current = url;
      el.src = url;
    }
    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack?.url, currentIndex, isPlaying]);

  useEffect(() => {
    if (!currentTrack && isPlaying) setIsPlaying(false);
  }, [currentTrack, isPlaying]); // currentTrack already in deps

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    applyVolume(el);
  }, [volume, muted, applyVolume]);

  useLayoutEffect(() => {
    if (tracks.length === 0 || autoplayDoneRef.current) return;
    const startIndex = Math.floor(Math.random() * tracks.length);
    const first = tracks[startIndex];
    if (!first) return;
    const el = audioRef.current;
    if (!el) return;
    autoplayDoneRef.current = true;
    skipNextLoadEffectRef.current = true;
    currentIndexRef.current = startIndex;
    setCurrentIndex(startIndex);
    lastLoadedUrlRef.current = first.url;
    // Используем начальное состояние из localStorage (через ref, чтобы не зависеть от изменений isPlaying)
    const shouldAutoPlay = initialIsPlayingRef.current;
    el.volume = 0;
    isFadingRef.current = true;
    el.src = first.url;
    const startPlay = () => {
      // Проверяем начальное состояние перед воспроизведением
      if (shouldAutoPlay) {
        el.play().catch(() => setIsPlaying(false));
      }
    };
    const onError = () => setIsPlaying(false);
    // Запускаем только если начальное состояние было isPlaying === true
    if (shouldAutoPlay) {
      startPlay();
    }
    el.addEventListener('canplay', startPlay, { once: true });
    el.addEventListener('error', onError, { once: true });
    return () => {
      el.removeEventListener('canplay', startPlay);
      el.removeEventListener('error', onError);
    };
  }, [tracks]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const startFadeIn = () => {
      if (fadeRafId.current != null) cancelAnimationFrame(fadeRafId.current);
      isFadingRef.current = true;
      el.volume = 0;
      const target = Math.max(0, Math.min(1, muted ? 0 : volume));
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.max(0, Math.min(1, (now - start) / FADE_IN_DURATION_MS));
        el.volume = Math.max(0, Math.min(1, target * t));
        if (t < 1) {
          fadeRafId.current = requestAnimationFrame(tick);
        } else {
          isFadingRef.current = false;
          fadeRafId.current = null;
        }
      };
      fadeRafId.current = requestAnimationFrame(tick);
    };

    const onPlaying = () => startFadeIn();

    const onTimeUpdate = () => {
      if (!el.duration || !Number.isFinite(el.duration)) return;
      const remaining = (el.duration - el.currentTime) * 1000;
      if (remaining <= FADE_OUT_START_BEFORE_END_MS && remaining > 0 && !isFadingRef.current) {
        isFadingRef.current = true;
        if (fadeRafId.current != null) cancelAnimationFrame(fadeRafId.current);
        const startVol = Math.max(0, Math.min(1, el.volume));
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.max(0, Math.min(1, (now - start) / FADE_OUT_DURATION_MS));
          el.volume = Math.max(0, Math.min(1, startVol * (1 - t)));
          if (t < 1) {
            fadeRafId.current = requestAnimationFrame(tick);
          } else {
            isFadingRef.current = false;
            fadeRafId.current = null;
          }
        };
        fadeRafId.current = requestAnimationFrame(tick);
      }
    };

    const onEnded = () => playNext();

    el.addEventListener('playing', onPlaying);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      if (fadeRafId.current != null) cancelAnimationFrame(fadeRafId.current);
    };
  }, [playNext, volume, muted]);

  const togglePlay = () => {
    if (!currentTrack) {
      return;
    }
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  // Показываем плеер даже если треков нет, чтобы пользователь видел, что функция доступна
  // if (tracks.length === 0) return null;

  return (
    <>
      <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      <div className="flex items-center gap-2 text-xs">
        {/* Иконка музыки */}
        <Music size={14} className={`flex-shrink-0 ${tracks.length === 0 ? 'text-gray-400' : 'text-gray-500'}`} />
        
        {/* Кнопка воспроизведения/паузы */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={tracks.length === 0}
          className={`flex-shrink-0 p-0.5 rounded transition-colors ${
            tracks.length === 0
              ? 'text-gray-400 cursor-not-allowed'
              : isPlaying
              ? 'text-primary-600 hover:text-primary-700'
              : 'text-gray-600 hover:text-gray-700'
          }`}
          title={tracks.length === 0 ? 'Нет треков' : isPlaying ? 'Пауза' : 'Воспроизведение'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Кнопка следующего трека */}
        {tracks.length > 1 && (
          <button
            type="button"
            onClick={playNext}
            className="flex-shrink-0 p-0.5 rounded text-gray-600 hover:text-gray-700 transition-colors"
            title="Следующий трек"
          >
            <SkipForward size={14} />
          </button>
        )}

        {/* Громкость */}
        <div className="flex items-center gap-1 min-w-[70px]">
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            disabled={tracks.length === 0}
            className={`flex-shrink-0 p-0.5 rounded transition-colors ${
              tracks.length === 0
                ? 'text-gray-400 cursor-not-allowed'
                : muted
                ? 'text-gray-500 hover:text-gray-600'
                : 'text-gray-600 hover:text-gray-700'
            }`}
            title={muted ? 'Включить звук' : 'Выключить звук'}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0) setMuted(false);
            }}
            disabled={tracks.length === 0}
            className={`flex-1 h-1 rounded-full appearance-none cursor-pointer transition-all ${
              tracks.length === 0
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-gray-200 accent-primary-600'
            }`}
            style={{
              background: tracks.length > 0 && !muted
                ? `linear-gradient(to right, #2563eb 0%, #2563eb ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
                : undefined
            }}
            title="Громкость"
          />
        </div>

        {/* Название трека */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className={`truncate max-w-[120px] ${
              tracks.length === 0 ? 'text-gray-400' : 'text-gray-700'
            }`}
            title={currentTrack?.name || 'Нет треков'}
          >
            {currentTrack?.name ?? (tracks.length === 0 ? 'Нет треков' : '—')}
          </span>
          {tracks.length > 0 && (
            <span className="text-[10px] text-gray-400">
              {currentIndex + 1}/{tracks.length}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
