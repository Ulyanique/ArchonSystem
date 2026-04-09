import { Dice5, Loader2 } from 'lucide-react';

interface FormFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (e: any) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
  onDiceClick?: (field?: string) => void | Promise<void>;
  isGenerating?: boolean;
  options?: { value: string; label: string }[];
}

export function FormField({ label, name, value, onChange, type = 'text', placeholder, rows, onDiceClick, isGenerating, options }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-dark-500 uppercase tracking-wider">{label}</label>
        {onDiceClick && (
          <button
            type="button"
            onClick={() => onDiceClick()}
            disabled={isGenerating}
            className="p-1 text-primary-500 hover:bg-primary-50 rounded transition-colors"
            title="Сгенерировать ИИ"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Dice5 size={14} />}
          </button>
        )}
      </div>
      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value || ''}
          onChange={onChange}
          rows={rows || 3}
          className="input w-full resize-none"
          placeholder={placeholder}
        />
      ) : type === 'select' && options ? (
        <select
          name={name}
          value={value || ''}
          onChange={onChange}
          className="input w-full"
        >
          <option value="">Не указано</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value || ''}
          onChange={onChange}
          className="input w-full"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function DemographicSection({ state, onChange, onDiceClick, generatingField }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="font-semibold text-dark-800 border-b border-dark-100 pb-2">Основные данные</h4>
        <FormField label="Имя" name="name" value={state.name} onChange={onChange} onDiceClick={() => onDiceClick('name')} isGenerating={generatingField === 'name'} />
        <FormField 
          label="Пол / Гендер" 
          name="gender" 
          value={state.gender} 
          onChange={onChange} 
          type="select"
          options={[
            { value: 'Мужской', label: 'Мужской' },
            { value: 'Женский', label: 'Женский' },
            { value: 'Безполое', label: 'Безполое' }
          ]}
        />
        <FormField label="Национальность" name="nationality" value={state.nationality} onChange={onChange} onDiceClick={() => onDiceClick('nationality')} isGenerating={generatingField === 'nationality'} />
        <FormField label="Место рождения" name="birth_place" value={state.birth_place} onChange={onChange} onDiceClick={() => onDiceClick('birth_place')} isGenerating={generatingField === 'birth_place'} />
        <div className="grid grid-cols-2 gap-4">
            <FormField label="Дата рожд. (текст)" name="birth_date" value={state.birth_date} onChange={onChange} placeholder="Весна 2006..." />
            <FormField label="Дата смерти (текст)" name="death_date" value={state.death_date} onChange={onChange} placeholder="Если применимо" />
        </div>
      </div>
      <div className="space-y-4">
        <h4 className="font-semibold text-dark-800 border-b border-dark-100 pb-2">Календарь (числа)</h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Год рождения" name="birth_universe_year" type="number" value={state.birth_universe_year} onChange={onChange} />
          <FormField label="День рождения" name="birth_universe_day" type="number" value={state.birth_universe_day} onChange={onChange} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Год смерти" name="death_universe_year" type="number" value={state.death_universe_year} onChange={onChange} />
          <FormField label="День смерти" name="death_universe_day" type="number" value={state.death_universe_day} onChange={onChange} />
        </div>
        <div className="pt-2">
          <p className="text-[10px] text-dark-400 leading-tight">
            * Год и день используются для автоматического расчёта возраста в чате и проверки, жив ли герой в выбранный момент времени.
          </p>
        </div>
      </div>
    </div>
  );
}
