export interface Universe {
  id: number;
  title: string;
  description: string;
  genre: string;
  direction?: string;
  style_notes?: string;
  universe_type?: string;
  cover_image_path?: string | null;
  created_at: string;
  updated_at: string;
  /** Настройки внутреннего времени вселенной (отличного от реального) */
  clock_enabled?: boolean | number;
  universe_start_year?: number | null;
  universe_start_day?: number | null;
  universe_start_hour?: number | null;
  universe_hours_per_day?: number | null;
  universe_days_per_year?: number | null;
  universe_epoch_name?: string | null;
  universe_time_scale?: number | null;
  universe_reference_real_date?: string | null;
  /** Счётчики (могут приходить с API или считаться на клиенте) */
  characters_count?: number;
  chapters_count?: number;
  locations_count?: number;
}

export interface UniverseCreate {
  title: string;
  description: string;
  genre: string;
  direction?: string;
  style_notes?: string;
  universe_type?: string;
}

/** Обновление вселенной (все поля опциональны), включая настройки времени */
export interface UniverseUpdate {
  title?: string;
  description?: string;
  genre?: string;
  direction?: string;
  style_notes?: string;
  universe_type?: string;
  cover_image_path?: string | null;
  clock_enabled?: boolean | number;
  universe_start_year?: number | null;
  universe_start_day?: number | null;
  universe_start_hour?: number | null;
  universe_hours_per_day?: number | null;
  universe_days_per_year?: number | null;
  universe_epoch_name?: string | null;
  universe_time_scale?: number | null;
  universe_reference_real_date?: string | null;
}

export interface OutlineItem {
  id: number;
  universe_id: number;
  sort_order: number;
  title: string;
  summary: string;
  outline_type: string;
  chapter_id: number | null;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: number;
  universe_id?: number;
  name: string;
  description: string;
  role: string;
  traits: string;
  appearance: string;
  backstory: string;
  portrait_image_path?: string | null;
  portrait_ai_prompt?: string | null;
  ai_analysis?: string | null;
  // Демографические данные
  age?: number | null; // устаревшее: возраст задаётся датой рождения в календаре вселенной
  gender?: string | null;
  nationality?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  /** Календарь вселенной: год/день рождения и смерти — для расчёта возраста и проверки «жив в момент X» в чате */
  birth_universe_year?: number | null;
  birth_universe_day?: number | null;
  death_universe_year?: number | null;
  death_universe_day?: number | null;
  // Отношения
  relationships?: string | null;
  // Навыки и способности
  profession?: string | null;
  skills?: string | null;
  abilities?: string | null;
  // Мотивация и цели
  goals?: string | null;
  fears?: string | null;
  conflicts?: string | null;
  character_values?: string | null;
  // Речь и манеры
  speech_pattern?: string | null;
  mannerisms?: string | null;
  habits?: string | null;
  /** human — речь по возрасту; ageless — не зависит от возраста (ИИ, робот) */
  speech_development?: string | null;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterCreate {
  name: string;
  description?: string;
  role?: string;
  traits?: string;
  appearance?: string;
  backstory?: string;
  // Демографические данные (возраст не храним — считается по дате рождения и времени диалога)
  gender?: string | null;
  nationality?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  birth_universe_year?: number | null;
  birth_universe_day?: number | null;
  death_universe_year?: number | null;
  death_universe_day?: number | null;
  // Отношения
  relationships?: string | null;
  // Навыки и способности
  profession?: string | null;
  skills?: string | null;
  abilities?: string | null;
  // Мотивация и цели
  goals?: string | null;
  fears?: string | null;
  conflicts?: string | null;
  character_values?: string | null;
  // Речь и манеры
  speech_pattern?: string | null;
  mannerisms?: string | null;
  habits?: string | null;
  speech_development?: string | null;
  enabled?: boolean;
  ai_analysis?: string | null;
}

export interface Location {
  id: number;
  universe_id: number;
  name: string;
  description: string;
  location_type: string;
  details: string;
  enabled?: boolean;
  image_path?: string | null;
  image_ai_prompt?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationCreate {
  name: string;
  description?: string;
  location_type?: string;
  details?: string;
  enabled?: boolean;
}

export interface Storyline {
  id: number;
  universe_id: number;
  title: string;
  description: string;
  sort_order: number;
  main_character_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface StorylineCreate {
  title: string;
  description?: string;
  sort_order?: number;
  main_character_id?: number | null;
}

export interface StorylineUpdate {
  title?: string;
  description?: string;
  sort_order?: number;
  main_character_id?: number | null;
}

export interface Chapter {
  id: number;
  universe_id: number;
  title: string;
  chapter_number: number;
  content: string;
  summary: string;
  notes: string;
  enabled?: boolean;
  storyline_id?: number | null;
  storyline_order?: number;
  reading_order?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterCreate {
  title: string;
  chapter_number?: number;
  content?: string;
  summary?: string;
  notes?: string;
  enabled?: boolean;
  storyline_id?: number | null;
  storyline_order?: number;
  reading_order?: number | null;
}

export interface SceneBeat {
  id: number;
  chapter_id: number;
  sort_order: number;
  title: string;
  description: string;  // неизменяемое описание сцены (что происходит)
  content: string;     // сгенерированный/написанный текст сцены
  enabled?: boolean;   // false = скрыть из контекста, затемнить в UI
  collapsed?: boolean; // true = свёрнуто (текст сцены скрыт в редакторе)
  created_at: string;
  updated_at: string;
}

export interface SceneBeatCreate {
  title?: string;
  description?: string;
  content?: string;
  sort_order?: number;
  enabled?: boolean;
  collapsed?: boolean;
}

export interface SceneBeatUpdate {
  title?: string;
  description?: string;
  content?: string;
  sort_order?: number;
  enabled?: boolean;
  collapsed?: boolean;
}

export interface Note {
  id: number;
  universe_id: number;
  title: string;
  content: string;
  note_type: string;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  content?: string;
  note_type?: string;
  enabled?: boolean;
}

/** AI-generated character idea (from ai-generate/characters) */
export interface GeneratedCharacter {
  name: string;
  age?: number;
  trait?: string;
  traits?: string;
  appearance?: string;
  backstory?: string;
  motivation?: string;
  description?: string;
  role?: string;
  // Демографические данные
  gender?: string;
  nationality?: string;
  birth_place?: string;
  birth_date?: string;
  death_date?: string;
  // Отношения
  relationships?: string | Array<{ character_id: number; type: string; description: string }>;
  // Навыки и способности
  profession?: string;
  skills?: string;
  abilities?: string;
  // Мотивация и цели
  goals?: string;
  fears?: string;
  conflicts?: string;
  character_values?: string;
  // Речь и манеры
  speech_pattern?: string;
  mannerisms?: string;
  habits?: string;
}

/** AI-generated location idea (from ai-generate/locations) */
export interface GeneratedLocation {
  name: string;
  type?: string;
  location_type?: string;
  description?: string;
  secret?: string;
  details?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  universe_timestamp?: string | null;
  timestamp?: number;
  model?: string;
  provider?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  universe_timestamp?: string | null;
  prompt?: string | null;  // Системный промпт для отображения
  rag_context?: string | null;  // Фрагменты из RAG для отображения
}

export interface Link {
  id: number;
  universe_id: number;
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  link_type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  universe_id: number;
  position?: { x: number; y: number };
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface TimelineEvent {
  id: number;
  universe_id: number;
  title: string;
  description: string;
  date_value: string | null;
  sort_order: number;
  universe_year?: number | null;
  universe_day?: number | null;
  event_type: string;
  chapter_id: number | null;
  location_id: number | null;
  character_ids: number[];
  witness_character_ids?: number[];
  heard_by_character_ids?: number[];
  read_by_character_ids?: number[];
  created_at: string;
  updated_at: string;
}

export interface LinkCreate {
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  link_type: string;
  description?: string;
}

export interface LinkUpdate {
  link_type?: string;
  description?: string;
}

export interface TimelineCreate {
  title: string;
  description: string;
  date_value?: string | null;
  sort_order?: number;
  event_type: string;
  chapter_id?: number | null;
  location_id?: number | null;
  character_ids?: number[];
}

export interface TimelineUpdate {
  title?: string;
  description?: string;
  date_value?: string | null;
  sort_order?: number;
  event_type?: string;
  chapter_id?: number | null;
  location_id?: number | null;
  character_ids?: number[];
  witness_character_ids?: number[];
  heard_by_character_ids?: number[];
  read_by_character_ids?: number[];
}

export interface OutlineGenerateResponse {
  items: GeneratedOutlineItem[];
}

export interface GeneratedOutlineItem {
  title: string;
  summary: string;
  outline_type: string;
  sort_order: number;
}

export interface ExportOptions {
  include_characters?: boolean;
  include_locations?: boolean;
  include_chapters?: boolean;
  include_notes?: boolean;
  include_timeline?: boolean;
}

export interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  url?: string;
  content?: string;
  universe_id?: number;
}

/** Ответ API поиска: сгруппированные по типам массивы + total */
export interface SearchResponse {
  characters?: SearchResult[];
  locations?: SearchResult[];
  chapters?: SearchResult[];
  notes?: SearchResult[];
  timeline?: SearchResult[];
  wiki?: SearchResult[];
  total: number;
}

export interface Quote {
  id: number;
  universe_id: number;
  character_id: number;
  interlocutor_type: 'character' | 'author' | 'helper';
  interlocutor_id?: number | null;
  quote_text: string;
  context?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteCreate {
  universe_id: number;
  character_id: number;
  interlocutor_type: 'character' | 'author' | 'helper';
  interlocutor_id?: number | null;
  quote_text: string;
  context?: string | null;
}

export interface QuoteUpdate {
  character_id?: number;
  interlocutor_type?: 'character' | 'author' | 'helper';
  interlocutor_id?: number | null;
  quote_text?: string;
  context?: string | null;
}

export interface LinkSuggestion {
  target_type: string;
  target_id: number;
  target_label: string;
  target_name?: string;
  link_type: string;
  suggested_type?: string;
  description?: string;
}

export interface AIIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

export interface AIContradiction {
  field?: string;
  value1?: string;
  value2?: string;
  context?: string;
  type?: string;
  description?: string;
}

export interface AIAnalysis {
  summary?: string;
  score?: number;
  issues?: AIIssue[];
  suggestions?: string[];
  strengths?: string[];
  questions?: string[];
  related_ideas?: string[];
  contradictions?: AIContradiction[];
}

export interface ReactFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: React.ReactElement;
  };
}

export interface GeneratedNote {
  title: string;
  content: string;
  note_type: string;
}

export interface WikiArticle {
  id: number;
  universe_id: number;
  title: string;
  slug: string;
  content: string;
  article_type: string;
  linked_entity_type?: string | null;
  linked_entity_id?: number | null;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface WikiArticleCreate {
  title: string;
  slug?: string;
  content?: string;
  article_type?: string;
  linked_entity_type?: string | null;
  linked_entity_id?: number | null;
  auto_generated?: boolean;
}

export interface WikiArticleUpdate {
  title?: string;
  slug?: string;
  content?: string;
  article_type?: string;
  linked_entity_type?: string | null;
  linked_entity_id?: number | null;
  auto_generated?: boolean;
}

export interface CharacterKnowledge {
  id: number;
  character_id: number;
  target_type: string;
  target_id: number;
  knowledge_level: string;
  source_type?: string | null;
  source_id?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterKnowledgeCreate {
  target_type: string;
  target_id: number;
  knowledge_level: string;
  source_type?: string | null;
  source_id?: number | null;
  notes?: string | null;
}

export interface CharacterKnowledgeUpdate {
  knowledge_level?: string;
  source_type?: string | null;
  source_id?: number | null;
  notes?: string | null;
}

/** Системные настройки (тема, тосты, промпты, LLM) */
export interface SystemSettings {
  theme?: string;
  accent_color?: string;
  show_toast_notifications?: boolean;
  toast_position?: string;
  toast_duration?: number;
  prompt_settings?: string | Record<string, unknown>;
  enable_rag?: boolean;
  context_window_size?: number;
  /** Макс. символов черновиков в контексте чата (общий бюджет) */
  draft_context_budget?: number;
  /** Модели LLM (для настроек чата) */
  default_llm_provider?: string;
  default_provider?: string;
  ollama_model?: string;
  deepseek_model?: string;
  openrouter_model?: string;
  routerai_model?: string;
  image_provider?: string;
  pixazo_model?: string;
  openrouter_image_model?: string;
  whisk_google_cookie?: string;
}
