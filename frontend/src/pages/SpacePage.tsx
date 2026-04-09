import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Globe,
  Ship,
  Map as MapIcon,
  ChevronRight,
  Plus,
  MapPin,
  Mountain,
  Loader2,
  Rocket,
  X,
  Save,
  Grid3X3,
  Star,
  ChevronLeft,
} from 'lucide-react';
import { spaceApi, locationsApi } from '../api';
import type { Location } from '../types';
import { Space3DView } from '../components/space/Space3DView';

type MapCell = { x: number; y: number; type: 'wall' } | { x: number; y: number; type: 'location'; location_id: number };

const BODY_TYPES = [
  { value: 'Planet', label: 'Планета' },
  { value: 'Moon', label: 'Спутник' },
  { value: 'Asteroid', label: 'Астероид' },
  { value: 'Station', label: 'Станция' },
  { value: 'Ship', label: 'Корабль' },
  { value: '', label: 'Другое' },
];

export default function SpacePage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [selectedGalaxy, setSelectedGalaxy] = useState<any>(null);
  const [selectedSystem, setSelectedSystem] = useState<any>(null);
  const [selectedBody, setSelectedBody] = useState<any>(null);
  const [showAddGalaxy, setShowAddGalaxy] = useState(false);
  const [showAddSystem, setShowAddSystem] = useState(false);
  const [showAddBody, setShowAddBody] = useState(false);
  const [newGalaxyName, setNewGalaxyName] = useState('');
  const [newSystemName, setNewSystemName] = useState('');
  const [newBodyName, setNewBodyName] = useState('');
  const [newBodyType, setNewBodyType] = useState('Planet');
  // Режим правой панели при выбранном объекте: превью объекта или карта/схема
  const [bodyView, setBodyView] = useState<'object' | 'map'>('object');
  // Режим визуализации: 2D (схема/канвас) или 3D (Three.js)
  const [spaceViewMode, setSpaceViewMode] = useState<'2d' | '3d'>('3d');

  const uid = parseInt(universeId!);

  // При смене выбранного тела сбрасываем на превью объекта
  useEffect(() => {
    setBodyView('object');
  }, [selectedBody?.id]);

  const { data: galaxies = [], isLoading: loadingGalaxies } = useQuery({
    queryKey: ['galaxies', universeId],
    queryFn: () => spaceApi.getGalaxies(uid),
  });

  const { data: systems = [], isLoading: loadingSystems } = useQuery({
    queryKey: ['systems', universeId, selectedGalaxy?.id],
    queryFn: () => spaceApi.getSystems(uid, selectedGalaxy.id),
    enabled: !!selectedGalaxy,
  });

  const { data: bodies = [], isLoading: loadingBodies } = useQuery({
    queryKey: ['bodies', universeId, selectedSystem?.id],
    queryFn: () => spaceApi.getBodies(uid, selectedSystem.id),
    enabled: !!selectedSystem,
  });

  // Подставить обновлённое тело из списка после сохранения/изменения сетки
  useEffect(() => {
    if (!selectedBody || !bodies.length) return;
    const updated = bodies.find((b: any) => b.id === selectedBody.id);
    if (updated && updated !== selectedBody) setSelectedBody(updated);
  }, [bodies, selectedBody?.id]);

  const createGalaxy = useMutation({
    mutationFn: (name: string) => spaceApi.createGalaxy(uid, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galaxies', universeId] });
      setNewGalaxyName('');
      setShowAddGalaxy(false);
      toast.success('Галактика создана');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Ошибка создания галактики'),
  });

  const createSystem = useMutation({
    mutationFn: (name: string) =>
      spaceApi.createSystem(uid, { name, galaxy_id: selectedGalaxy.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems', universeId, selectedGalaxy?.id] });
      setNewSystemName('');
      setShowAddSystem(false);
      toast.success('Звёздная система создана');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Ошибка создания системы'),
  });

  const createBody = useMutation({
    mutationFn: (data: { name: string; body_type: string }) =>
      spaceApi.createBody(uid, {
        name: data.name,
        star_system_id: selectedSystem.id,
        body_type: data.body_type || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodies', universeId, selectedSystem?.id] });
      setNewBodyName('');
      setNewBodyType('Planet');
      setShowAddBody(false);
      toast.success('Объект создан');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Ошибка создания объекта'),
  });

  if (loadingGalaxies) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Компактная верхняя строка: заголовок + навигация */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 py-3 px-1 border-b border-dark-200 bg-dark-50">
        <h1 className="text-lg font-bold text-dark-800 flex items-center gap-2 mr-2">
          <Rocket className="text-primary-600" size={20} /> Пространство
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-dark-500 whitespace-nowrap">Галактика:</label>
          <select
            className="input py-1.5 px-2 text-sm min-w-0 max-w-[180px]"
            value={selectedGalaxy?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              const g = galaxies.find((x: any) => x.id === id);
              setSelectedGalaxy(g || null);
              setSelectedSystem(null);
              setSelectedBody(null);
            }}
          >
            <option value="">— выбрать —</option>
            {galaxies.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowAddGalaxy(true)} className="p-1.5 rounded-md hover:bg-primary-100 text-primary-600" title="Добавить галактику">
            <Plus size={16} />
          </button>

          {selectedGalaxy && (
            <>
              <ChevronRight size={14} className="text-dark-400" />
              <label className="text-xs text-dark-500 whitespace-nowrap">Система:</label>
              <select
                className="input py-1.5 px-2 text-sm min-w-0 max-w-[180px]"
                value={selectedSystem?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const s = systems.find((x: any) => x.id === id);
                  setSelectedSystem(s || null);
                  setSelectedBody(null);
                }}
                disabled={loadingSystems}
              >
                <option value="">— выбрать —</option>
                {systems.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowAddSystem(true)} className="p-1.5 rounded-md hover:bg-primary-100 text-primary-600" title="Добавить систему">
                <Plus size={16} />
              </button>
            </>
          )}

          {selectedSystem && (
            <>
              <ChevronRight size={14} className="text-dark-400" />
              <label className="text-xs text-dark-500 whitespace-nowrap">Объект:</label>
              <select
                className="input py-1.5 px-2 text-sm min-w-0 max-w-[180px]"
                value={selectedBody?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const b = bodies.find((x: any) => x.id === id);
                  setSelectedBody(b || null);
                }}
                disabled={loadingBodies}
              >
                <option value="">— выбрать —</option>
                {bodies.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowAddBody(true)} className="p-1.5 rounded-md hover:bg-primary-100 text-primary-600" title="Добавить объект">
                <Plus size={16} />
              </button>
            </>
          )}

          {(selectedGalaxy && !selectedSystem) || (selectedSystem && !selectedBody) ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-dark-500 uppercase tracking-wider">Вид:</span>
              <div className="flex rounded-md overflow-hidden border border-dark-600">
                <button
                  type="button"
                  onClick={() => setSpaceViewMode('2d')}
                  className={`px-2.5 py-1 text-sm ${spaceViewMode === '2d' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-dark-500 hover:bg-dark-300'}`}
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setSpaceViewMode('3d')}
                  className={`px-2.5 py-1 text-sm ${spaceViewMode === '3d' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-dark-500 hover:bg-dark-300'}`}
                >
                  3D
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Контент — min-h чтобы блок не схлопывался при flex */}
      <div className="flex-1 min-h-[60vh] flex flex-col rounded-b-xl overflow-hidden border border-t-0 border-dark-200 bg-dark-900 shadow-xl">
          {/* Контент по уровню */}
          <div className="flex-1 min-h-0 flex flex-col">
            {!selectedGalaxy && (
              <GalaxiesScheme
                galaxies={galaxies}
                onSelect={(g) => {
                  setSelectedGalaxy(g);
                  setSelectedSystem(null);
                  setSelectedBody(null);
                }}
                onAdd={() => setShowAddGalaxy(true)}
              />
            )}

            {selectedGalaxy && !selectedSystem && (
              <div className="flex-1 min-h-0 flex flex-col">
                {spaceViewMode === '3d' ? (
                  <div className="flex-1 min-h-[400px] relative">
                    {loadingSystems ? (
                      <div className="absolute inset-0 flex items-center justify-center text-dark-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : (
                      <div className="absolute inset-0">
                        <Space3DView
                          mode="galaxy"
                          systems={systems}
                          selectedSystemId={selectedSystem?.id ?? null}
                          onSelectSystem={(s) => {
                            setSelectedSystem(s);
                            setSelectedBody(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <SystemsScheme
                    systems={systems}
                    loading={loadingSystems}
                    galaxyName={selectedGalaxy.name}
                    onSelect={(s) => {
                      setSelectedSystem(s);
                      setSelectedBody(null);
                    }}
                    onAdd={() => setShowAddSystem(true)}
                  />
                )}
              </div>
            )}

            {selectedGalaxy && selectedSystem && !selectedBody && (
              <div className="flex-1 min-h-0 flex flex-col">
                {spaceViewMode === '3d' ? (
                  <div className="flex-1 min-h-[400px] relative">
                    {loadingBodies ? (
                      <div className="absolute inset-0 flex items-center justify-center text-dark-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : (
                      <div className="absolute inset-0">
                        <Space3DView
                          mode="system"
                          bodies={bodies}
                          selectedBodyId={selectedBody?.id ?? null}
                          onSelectBody={setSelectedBody}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <BodiesOrbitScheme
                    bodies={bodies}
                    loading={loadingBodies}
                    systemName={selectedSystem.name}
                    onSelect={setSelectedBody}
                    onAdd={() => setShowAddBody(true)}
                  />
                )}
              </div>
            )}

            {selectedBody && bodyView === 'object' && (
              <ObjectPreview
                body={selectedBody}
                onOpenMap={() => setBodyView('map')}
              />
            )}

            {selectedBody && bodyView === 'map' && (
              <div className="flex flex-col h-full min-h-0">
                <div className="shrink-0 px-4 py-2 flex items-center justify-between border-b border-amber-700/30 bg-[#080d08]">
                  <button
                    type="button"
                    onClick={() => setBodyView('object')}
                    className="flex items-center gap-2 text-amber-200/90 hover:text-amber-100 text-sm"
                  >
                    <ChevronLeft size={16} /> К объекту
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <LocalMap
                    universeId={uid}
                    body={selectedBody}
                    onSave={(data: any) =>
                      spaceApi.updateBody(uid, selectedBody.id, { map_data: JSON.stringify(data) })
                    }
                    onBodyUpdate={(patch) =>
                      spaceApi.updateBody(uid, selectedBody.id, patch).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['bodies', universeId, selectedSystem?.id] });
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Модалки создания */}
      {showAddGalaxy && (
        <Modal title="Новая галактика" onClose={() => setShowAddGalaxy(false)}>
          <input
            className="input mb-4"
            placeholder="Название галактики"
            value={newGalaxyName}
            onChange={(e) => setNewGalaxyName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddGalaxy(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!newGalaxyName.trim() || createGalaxy.isPending}
              onClick={() => createGalaxy.mutate(newGalaxyName.trim())}
            >
              {createGalaxy.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </button>
          </div>
        </Modal>
      )}

      {showAddSystem && (
        <Modal title="Новая звёздная система" onClose={() => setShowAddSystem(false)}>
          <input
            className="input mb-4"
            placeholder="Название системы"
            value={newSystemName}
            onChange={(e) => setNewSystemName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddSystem(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!newSystemName.trim() || createSystem.isPending}
              onClick={() => createSystem.mutate(newSystemName.trim())}
            >
              {createSystem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </button>
          </div>
        </Modal>
      )}

      {showAddBody && (
        <Modal title="Новый объект (планета / корабль / ...)" onClose={() => setShowAddBody(false)}>
          <input
            className="input mb-3"
            placeholder="Название"
            value={newBodyName}
            onChange={(e) => setNewBodyName(e.target.value)}
            autoFocus
          />
          <select
            className="input mb-4"
            value={newBodyType}
            onChange={(e) => setNewBodyType(e.target.value)}
          >
            {BODY_TYPES.map((t) => (
              <option key={t.value || 'other'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddBody(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!newBodyName.trim() || createBody.isPending}
              onClick={() => createBody.mutate({ name: newBodyName.trim(), body_type: newBodyType })}
            >
              {createBody.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --- Визуализация галактики (Canvas) --- */

type GalaxyCanvasProps = {
  width: number;
  height: number;
  className?: string;
  /** Количество рукавов спирали */
  arms?: number;
  /** Число звёзд */
  stars?: number;
  /** Вращение (рад/кадр) */
  animate?: boolean;
  /** Масштаб (0–1), для маленьких превью */
  scale?: number;
};

function GalaxyCanvas({
  width,
  height,
  className = '',
  arms = 4,
  stars = 2800,
  animate = true,
  scale = 1,
}: GalaxyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<{ x: number; y: number; r: number; brightness: number }[]>([]);

  const generateParticles = useCallback(() => {
    const maxR = 0.95;
    const spin = 2.8;
    const out: { x: number; y: number; r: number; brightness: number }[] = [];
    for (let i = 0; i < stars; i++) {
      const radius = Math.pow(Math.random(), 1.4) * maxR;
      const branchAngle = ((i % arms) / arms) * Math.PI * 2;
      const spinAngle = radius * spin;
      const angle = branchAngle + spinAngle;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const brightness = 0.4 + 0.6 * (1 - radius / maxR);
      out.push({ x, y, r: radius, brightness });
    }
    return out;
  }, [stars, arms]);

  useEffect(() => {
    if (particlesRef.current.length === 0) particlesRef.current = generateParticles();
  }, [generateParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const context = ctx;

    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height) * 0.45 * scale;

    function draw() {
      context.save();
      context.scale(dpr, dpr);
      context.clearRect(0, 0, width, height);

      const rot = rotationRef.current;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      particlesRef.current.forEach((p) => {
        const rx = p.x * cos - p.y * sin;
        const ry = p.x * sin + p.y * cos;
        const px = cx + rx * size;
        const py = cy + ry * size;

        const alpha = 0.3 + p.brightness * 0.7;
        const gradient = context.createRadialGradient(px, py, 0, px, py, 2.5);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(199, 210, 254, ${alpha * 0.7})`);
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        context.beginPath();
        context.arc(px, py, 2.5, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();
      });

      context.restore();

      if (animate) {
        rotationRef.current += 0.0025;
        frameRef.current = requestAnimationFrame(draw);
      }
    }

    draw();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [width, height, scale, animate, generateParticles]);

  return <canvas ref={canvasRef} className={className} style={{ display: 'block' }} />;
}

/* --- Схема: визуальные уровни --- */

function GalaxiesScheme({
  galaxies,
  onSelect,
  onAdd,
}: {
  galaxies: any[];
  onSelect: (g: any) => void;
  onAdd: () => void;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 640, h: 360 });

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 640, height: 360 };
      setCanvasSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Верхняя полоса: заголовок + кнопки выбора галактики */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-dark-700 bg-dark-800/40">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-dark-200">Галактики</h2>
            <p className="text-sm text-dark-500">Выберите галактику, чтобы перейти к звёздным системам</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {galaxies.map((g: any) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g)}
                className="group flex items-center gap-2 rounded-xl border-2 border-dark-600 bg-dark-700/80 px-4 py-2.5 text-left transition-all hover:border-primary-500/60 hover:bg-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                <div className="w-8 h-8 rounded-lg bg-dark-600 overflow-hidden shrink-0 flex items-center justify-center">
                  <GalaxyCanvas width={32} height={32} stars={280} arms={3} animate scale={0.65} className="opacity-90" />
                </div>
                <span className="font-medium text-dark-100 truncate max-w-[140px]">{g.name}</span>
                <ChevronRight size={18} className="text-dark-500 group-hover:text-primary-400 shrink-0" />
              </button>
            ))}
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-dark-600 px-4 py-2.5 text-dark-500 hover:border-primary-500/50 hover:text-primary-400 hover:bg-primary-500/5 transition-all"
            >
              <Plus size={20} />
              <span className="text-sm font-medium">Добавить галактику</span>
            </button>
          </div>
        </div>
        {galaxies.length === 0 && (
          <p className="text-sm text-dark-500 mt-2">Нет галактик. Нажмите «Добавить галактику» или выберите из списка слева.</p>
        )}
      </div>

      {/* Визуализация на всё оставшееся пространство */}
      <div ref={canvasWrapRef} className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.4) 0%, transparent 55%), radial-gradient(circle at 70% 30%, rgba(184, 134, 11, 0.15) 0%, transparent 45%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.08) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>
        <div className="absolute inset-0 rounded-b-3xl overflow-hidden border-b border-x border-dark-600 bg-dark-900/80">
          <GalaxyCanvas
            width={canvasSize.w}
            height={canvasSize.h}
            arms={4}
            stars={4000}
            animate
            scale={1}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

function SystemsScheme({
  systems,
  loading,
  galaxyName,
  onSelect,
  onAdd,
}: {
  systems: any[];
  loading: boolean;
  galaxyName: string;
  onSelect: (s: any) => void;
  onAdd: () => void;
}) {
  const hasCoords = systems.some((s: any) => (s.coord_x != null && s.coord_x !== 0) || (s.coord_y != null && s.coord_y !== 0));
  const scale = 80;
  const centerX = 200;
  const centerY = 200;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-3xl">
        <div className="absolute inset-0 opacity-[0.04]" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.3) 0%, transparent 60%)' }} />
      </div>
      <div className="relative z-10">
        <h2 className="text-lg font-bold text-dark-200 mb-1">{galaxyName}</h2>
        <p className="text-sm text-dark-500 mb-6">Звёздные системы. Выберите систему, чтобы увидеть объекты</p>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : hasCoords ? (
          <div className="relative min-h-[400px]" style={{ width: 420 }}>
            {systems.map((s: any, _i: number) => {
              const x = centerX + (s.coord_x ?? 0) * scale;
              const y = centerY + (s.coord_y ?? 0) * scale;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s)}
                  className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-amber-500/50 bg-dark-800 shadow-lg flex items-center justify-center text-amber-400 hover:border-amber-400 hover:scale-110 transition-all"
                  style={{ left: x, top: y }}
                  title={s.name}
                >
                  <Star size={18} />
                </button>
              );
            })}
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-2 mt-4">
              {systems.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s)}
                  className="px-4 py-2 rounded-xl bg-dark-700 border border-dark-600 text-dark-200 hover:border-amber-500/50 hover:text-amber-200 text-sm transition-all"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {systems.map((s: any) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s)}
                className="group rounded-xl border border-dark-600 bg-dark-800/80 p-4 text-left flex items-center justify-between hover:border-amber-500/50 hover:bg-dark-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Star size={20} />
                  </div>
                  <span className="font-medium text-dark-100">{s.name}</span>
                </div>
                <ChevronRight size={18} className="text-dark-500 group-hover:text-amber-400" />
              </button>
            ))}
            <button
              type="button"
              onClick={onAdd}
              className="rounded-xl border-2 border-dashed border-dark-600 text-dark-500 hover:border-amber-500/50 hover:text-amber-400 flex items-center justify-center gap-2 min-h-[72px]"
            >
              <Plus size={20} /> Добавить систему
            </button>
          </div>
        )}
        {systems.length === 0 && !loading && (
          <p className="text-dark-500 py-8">Нет звёздных систем. Добавьте первую.</p>
        )}
      </div>
    </div>
  );
}

function BodiesOrbitScheme({
  bodies,
  loading,
  systemName,
  onSelect,
  onAdd,
}: {
  bodies: any[];
  loading: boolean;
  systemName: string;
  onSelect: (b: any) => void;
  onAdd: () => void;
}) {
  const orbitRadius = 140;
  const centerX = 200;
  const centerY = 200;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-3xl">
        <div className="absolute inset-0 opacity-[0.05]" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 55%)' }} />
      </div>
      <div className="relative z-10">
        <h2 className="text-lg font-bold text-dark-200 mb-1">{systemName}</h2>
        <p className="text-sm text-dark-500 mb-6">Объекты системы. Выберите планету, спутник или корабль</p>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative mx-auto" style={{ width: 400, height: 400 }}>
              {/* Звезда в центре */}
              <div
                className="absolute w-16 h-16 rounded-full border-2 border-amber-500/40 flex items-center justify-center text-amber-300 shadow-lg"
                style={{
                  left: centerX - 32,
                  top: centerY - 32,
                  background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.9), rgba(245, 158, 11, 0.6))',
                  boxShadow: '0 0 40px rgba(251, 191, 36, 0.4), 0 0 80px rgba(251, 191, 36, 0.2)',
                }}
              >
                <Star size={28} className="text-amber-950" />
              </div>
              {/* Орбиты и тела */}
              {bodies.map((b: any, i: number) => {
                const angle = (i / Math.max(bodies.length, 1)) * 2 * Math.PI - Math.PI / 2;
                const r = orbitRadius + (i % 2) * 30;
                const x = centerX + r * Math.cos(angle);
                const y = centerY + r * Math.sin(angle);
                const isShip = b.body_type === 'Ship' || b.body_type === 'Station';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelect(b)}
                    className="absolute w-12 h-12 rounded-full border-2 border-emerald-500/50 bg-dark-800 flex items-center justify-center hover:scale-110 hover:border-emerald-400 transition-all shadow-lg z-10"
                    style={{
                      left: x - 24,
                      top: y - 24,
                      background: isShip ? 'linear-gradient(135deg, rgba(30, 58, 58, 0.9), rgba(15, 23, 42, 0.95))' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(15, 23, 42, 0.9))',
                    }}
                    title={b.name}
                  >
                    {isShip ? <Ship size={22} className="text-emerald-400" /> : <Globe size={22} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {bodies.map((b: any) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b)}
                  className="px-4 py-2.5 rounded-xl bg-dark-700 border border-dark-600 text-dark-200 hover:border-emerald-500/50 hover:text-emerald-200 text-sm transition-all flex items-center gap-2"
                >
                  {b.body_type === 'Ship' || b.body_type === 'Station' ? <Ship size={16} /> : <Globe size={16} />}
                  {b.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onAdd}
              className="mt-4 px-4 py-2 rounded-xl border-2 border-dashed border-dark-600 text-dark-500 hover:border-emerald-500/50 hover:text-emerald-400 text-sm"
            >
              <Plus size={16} className="inline mr-2 align-middle" />
              Добавить объект
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectPreview({ body, onOpenMap }: { body: any; onOpenMap: () => void }) {
  const isShip = body.body_type === 'Ship' || body.body_type === 'Station';
  const bodyTypeLabel = BODY_TYPES.find((t) => t.value === body.body_type)?.label || body.body_type || 'Объект';

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-3xl">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            background: isShip
              ? 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)'
              : 'radial-gradient(circle at 50% 40%, rgba(59, 130, 246, 0.12) 0%, transparent 55%)',
          }}
        />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[320px]">
        <div
          className="w-40 h-40 rounded-full border-2 flex items-center justify-center mb-6 transition-transform hover:scale-105"
          style={{
            borderColor: isShip ? 'rgba(16, 185, 129, 0.5)' : 'rgba(99, 102, 241, 0.5)',
            background: isShip
              ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.25))'
              : 'linear-gradient(145deg, rgba(99, 102, 241, 0.12), rgba(59, 130, 246, 0.15))',
            boxShadow: isShip ? '0 0 60px rgba(16, 185, 129, 0.2)' : '0 0 60px rgba(99, 102, 241, 0.15)',
          }}
        >
          {isShip ? <Ship size={64} className="text-emerald-400/90" /> : <Globe size={64} className="text-indigo-400/90" />}
        </div>
        <h3 className="text-xl font-bold text-dark-100 mb-1">{body.name}</h3>
        <p className="text-sm text-dark-500 mb-6">{bodyTypeLabel}</p>
        {body.description && (
          <p className="text-sm text-dark-400 max-w-md text-center mb-6 line-clamp-3">{body.description}</p>
        )}
        <button
          type="button"
          onClick={onOpenMap}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-primary-600 hover:bg-primary-500 text-white shadow-lg hover:shadow-primary-500/30 transition-all"
        >
          <MapIcon size={20} />
          {isShip ? 'Схема интерьера' : 'Карта местности'}
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-dark-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-dark-800">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-dark-100 text-dark-500">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LocalMap({
  universeId,
  body,
  onSave,
  onBodyUpdate,
}: {
  universeId: number;
  body: any;
  onSave: (data: MapCell[]) => void;
  onBodyUpdate: (patch: { map_width?: number; map_height?: number }) => Promise<any>;
}) {
  const [mapData, setMapData] = useState<MapCell[]>(() => {
    try {
      const raw = JSON.parse(body.map_data || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [mode, setMode] = useState<'terrain' | 'location'>('terrain');
  const [placeLocationId, setPlaceLocationId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showGridSize, setShowGridSize] = useState(false);
  const [editWidth, setEditWidth] = useState(() => body.map_width || 10);
  const [editHeight, setEditHeight] = useState(() => body.map_height || 10);

  const width = body.map_width || 10;
  const height = body.map_height || 10;

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(universeId),
  });

  const getCell = (x: number, y: number): MapCell | undefined =>
    mapData.find((c) => c.x === x && c.y === y);

  const handleCellClick = (x: number, y: number) => {
    if (mode === 'terrain') {
      const existing = mapData.find((c) => c.x === x && c.y === y);
      if (existing) {
        setMapData(mapData.filter((c) => c !== existing));
      } else {
        setMapData([...mapData, { x, y, type: 'wall' }]);
      }
      return;
    }
    if (mode === 'location') {
      const withoutThis = mapData.filter((c) => !(c.x === x && c.y === y));
      if (placeLocationId != null) {
        setMapData([...withoutThis, { x, y, type: 'location', location_id: placeLocationId }]);
        setPlaceLocationId(null);
      } else {
        setMapData(withoutThis);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(mapData);
      toast.success('Карта сохранена');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyGridSize = async () => {
    const w = Math.max(5, Math.min(50, editWidth));
    const h = Math.max(5, Math.min(50, editHeight));
    setEditWidth(w);
    setEditHeight(h);
    try {
      await onBodyUpdate({ map_width: w, map_height: h });
      setShowGridSize(false);
      toast.success('Размер сетки обновлён');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-[#050a05] text-amber-100/90 relative overflow-hidden">
      {/* Фоновый градиент */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(184, 134, 11, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Сетка с золотистым свечением */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(184, 134, 11, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(184, 134, 11, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Лёгкий scanline эффект */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02] z-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(184, 134, 11, 0.2) 2px, rgba(184, 134, 11, 0.2) 4px)',
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider text-amber-400/95 drop-shadow-[0_0_8px_rgba(184,134,11,0.5)]">
              {body.name} — карта местности
            </h3>
            <p className="text-xs font-mono text-amber-700/80 mt-0.5">
              Сетка {width}×{height}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowGridSize(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-200 text-sm hover:bg-amber-800/50 hover:border-amber-600/70 transition-all"
              title="Размер сетки"
            >
              <Grid3X3 size={14} />
              Сетка
            </button>
            <div className="flex rounded-lg overflow-hidden border border-amber-700/50">
              <button
                type="button"
                onClick={() => setMode('terrain')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-all ${mode === 'terrain' ? 'bg-amber-600 text-black shadow-[0_0_12px_rgba(184,134,11,0.6)]' : 'bg-amber-900/40 text-amber-200 hover:bg-amber-800/50'}`}
              >
                <Mountain size={14} /> Рельеф
              </button>
              <button
                type="button"
                onClick={() => setMode('location')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-all ${mode === 'location' ? 'bg-amber-600 text-black shadow-[0_0_12px_rgba(184,134,11,0.6)]' : 'bg-amber-900/40 text-amber-200 hover:bg-amber-800/50'}`}
              >
                <MapPin size={14} /> Локации
              </button>
            </div>
            {mode === 'location' && (
              <select
                className="bg-amber-900/60 border border-amber-700/50 rounded-lg px-3 py-1.5 text-sm text-amber-100 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                value={placeLocationId ?? ''}
                onChange={(e) => setPlaceLocationId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— выбрать локацию —</option>
                {(locations as Location[]).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-black font-medium hover:bg-amber-500 disabled:opacity-50 shadow-[0_0_12px_rgba(184,134,11,0.4)] transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              Сохранить
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-auto min-h-0 p-4">
          <div
            className="inline-block p-6 rounded-xl border-2 border-amber-700/40 bg-[#030803] shadow-2xl relative"
            style={{
              boxShadow: `
                inset 0 0 40px rgba(0,0,0,0.6),
                0 0 60px rgba(184, 134, 11, 0.15),
                0 0 120px rgba(184, 134, 11, 0.05)
              `,
            }}
          >
            {/* Сетка под картой с золотистым свечением */}
            <div
              className="absolute inset-0 pointer-events-none rounded-xl opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(184, 134, 11, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(184, 134, 11, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '32px 32px',
                backgroundPosition: 'center',
              }}
            />

            <div
              className="grid gap-[2px] relative z-10"
              style={{
                gridTemplateColumns: `repeat(${width}, 32px)`,
                gridTemplateRows: `repeat(${height}, 32px)`,
              }}
            >
              {Array.from({ length: height }).map((_, y) =>
                Array.from({ length: width }).map((_, x) => {
                  const cell = getCell(x, y);
                  const isWall = cell?.type === 'wall';
                  const locCell = cell?.type === 'location' ? cell : null;
                  const loc = locCell
                    ? (locations as Location[]).find((l) => l.id === locCell.location_id)
                    : null;
                  // Градиент для рельефа
                  const bgGradient = isWall
                    ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.4) 0%, rgba(139, 101, 8, 0.5) 50%, rgba(184, 134, 11, 0.3) 100%)'
                    : 'linear-gradient(135deg, rgba(10, 20, 10, 0.8) 0%, rgba(5, 15, 5, 0.9) 100%)';

                  return (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      onClick={() => handleCellClick(x, y)}
                      className="relative group"
                      style={{ width: '32px', height: '32px' }}
                      title={loc ? `${loc.name}${loc.location_type ? ` (${loc.location_type})` : ''}` : isWall ? 'Рельеф (клик — убрать)' : 'Пусто (клик — рельеф/локация)'}
                    >
                      {/* Фон ячейки */}
                      <div
                        className="absolute inset-0 rounded-sm transition-all duration-200"
                        style={{
                          background: bgGradient,
                          border: `1px solid ${isWall ? 'rgba(184, 134, 11, 0.6)' : 'rgba(184, 134, 11, 0.15)'}`,
                          boxShadow: isWall
                            ? `
                              inset 0 0 8px rgba(184, 134, 11, 0.3),
                              0 0 12px rgba(184, 134, 11, 0.2)
                            `
                            : 'none',
                        }}
                      />

                      {/* Контурные линии для рельефа (топографические линии) */}
                      {isWall && (
                        <>
                          {/* Верхняя линия */}
                          <div
                            className="absolute top-0 left-0 right-0 h-[1px] bg-amber-600/80"
                            style={{ boxShadow: '0 0 4px rgba(184, 134, 11, 0.8)' }}
                          />
                          {/* Левая линия */}
                          <div
                            className="absolute top-0 left-0 bottom-0 w-[1px] bg-amber-600/80"
                            style={{ boxShadow: '0 0 4px rgba(184, 134, 11, 0.8)' }}
                          />
                          {/* Внутренние контуры */}
                          <div
                            className="absolute top-[8px] left-[8px] right-[8px] h-[1px] bg-amber-700/60"
                            style={{ boxShadow: '0 0 2px rgba(184, 134, 11, 0.4)' }}
                          />
                          <div
                            className="absolute top-[16px] left-[8px] right-[8px] h-[1px] bg-amber-700/40"
                            style={{ boxShadow: '0 0 2px rgba(184, 134, 11, 0.3)' }}
                          />
                        </>
                      )}

                      {/* Локация — светящийся маркер с аурой */}
                      {loc && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {/* Аура свечения */}
                          <div
                            className="absolute inset-0 rounded-full animate-pulse"
                            style={{
                              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
                              boxShadow: '0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.3)',
                            }}
                          />
                          {/* Центральная точка */}
                          <div
                            className="relative z-10 w-3 h-3 rounded-full"
                            style={{
                              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(16, 185, 129, 0.8) 100%)',
                              boxShadow: '0 0 8px rgba(16, 185, 129, 1), 0 0 16px rgba(16, 185, 129, 0.6)',
                            }}
                          />
                          {/* Иконка булавки */}
                          <MapPin
                            size={16}
                            className="absolute z-20 text-emerald-300 drop-shadow-[0_0_4px_rgba(16,185,129,0.8)]"
                            style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 1))' }}
                          />
                        </div>
                      )}

                      {/* Hover эффект */}
                      <div
                        className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{
                          border: '2px solid rgba(184, 134, 11, 0.8)',
                          boxShadow: 'inset 0 0 12px rgba(184, 134, 11, 0.3), 0 0 16px rgba(184, 134, 11, 0.4)',
                        }}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-amber-700/90">
          <span className="flex items-center gap-2">
            <span
              className="w-5 h-5 border border-amber-700/30 bg-[#030803] inline-block rounded-sm"
              style={{ background: 'linear-gradient(135deg, rgba(10, 20, 10, 0.8) 0%, rgba(5, 15, 5, 0.9) 100%)' }}
            />
            Равнина
          </span>
          <span className="flex items-center gap-2">
            <span
              className="w-5 h-5 inline-block rounded-sm relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.4) 0%, rgba(139, 101, 8, 0.5) 50%, rgba(184, 134, 11, 0.3) 100%)',
                border: '1px solid rgba(184, 134, 11, 0.6)',
                boxShadow: 'inset 0 0 8px rgba(184, 134, 11, 0.3), 0 0 12px rgba(184, 134, 11, 0.2)',
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-600/80" />
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-amber-600/80" />
            </span>
            Рельеф
          </span>
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 relative inline-flex items-center justify-center rounded-sm">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
                }}
              />
              <MapPin size={12} className="relative z-10 text-emerald-300" />
            </span>
            Локация
          </span>
          <span className="ml-auto text-amber-600/80 italic">
            Режим «Рельеф»: клик — рельеф/убрать. Режим «Локации»: выберите локацию и кликните по ячейке.
          </span>
        </div>
      </div>

      {showGridSize && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowGridSize(false)}>
          <div
            className="bg-[#0d1f0d] border-2 border-amber-700/50 rounded-xl p-6 max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-amber-400 font-bold mb-4">Размер сетки</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-amber-600 mb-1">Ширина (5–50)</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={editWidth}
                  onChange={(e) => setEditWidth(Number(e.target.value) || 10)}
                  className="input bg-amber-950/60 border-amber-700/50 text-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-600 mb-1">Высота (5–50)</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={editHeight}
                  onChange={(e) => setEditHeight(Number(e.target.value) || 10)}
                  className="input bg-amber-950/60 border-amber-700/50 text-amber-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGridSize(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleApplyGridSize}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
