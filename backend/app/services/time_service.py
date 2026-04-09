from datetime import datetime, timezone
from app.models import Universe

class TimeService:
    """Сервис для расчета внутреннего времени вселенной."""

    def get_current_universe_time(self, universe: Universe) -> dict:
        """
        Рассчитать текущую дату и время во вселенной.
        Возвращает словарь с компонентами времени.
        """
        if not universe.clock_enabled:
            now = datetime.now(timezone.utc)
            return {
                "year": now.year,
                "day": now.timetuple().tm_yday,
                "hour": now.hour,
                "minute": now.minute,
                "second": now.second,
                "epoch": universe.universe_epoch_name or "н.э.",
                "display": f"{now.strftime('%H:%M')}, {now.timetuple().tm_yday} день {now.year} года {universe.universe_epoch_name or 'н.э.'}"
            }

        # 1. Реальное время сейчас и в точке отсчета
        now_real = datetime.now(timezone.utc)
        # Убираем осведомленность о часовом поясе для сравнения с БД если она не сохраняет таймзоны
        # Но SQLAlchemy с SQLite обычно не сохраняет таймзоны.
        # Если universe.created_at без таймзоны, возникнет ошибка при вычитании.
        ref_real = universe.universe_reference_real_date or universe.created_at or now_real
        if ref_real.tzinfo is None:
            ref_real = ref_real.replace(tzinfo=timezone.utc)

        # Разница в секундах
        delta_seconds = (now_real - ref_real).total_seconds()

        # 2. Масштабируем время
        scaled_delta_seconds = delta_seconds * (universe.universe_time_scale or 1.0)

        # 3. Переводим в часы (для простоты расчетов)
        delta_hours = scaled_delta_seconds / 3600.0

        # 4. Начальное состояние вселенной (в часах)
        # Считаем общее количество часов от "начала времен" до референсной точки
        h_per_day = universe.universe_hours_per_day or 24
        d_per_year = universe.universe_days_per_year or 365

        # Часы в текущем году до референсной точки
        ref_start_hours = (
            (universe.universe_start_year * d_per_year * h_per_day) +
            ((universe.universe_start_day - 1) * h_per_day) +
            universe.universe_start_hour
        )

        # 5. Текущее время в часах
        total_hours_now = ref_start_hours + delta_hours

        # 6. Раскладываем обратно на компоненты
        cur_hour = int(total_hours_now % h_per_day)
        total_days = int(total_hours_now // h_per_day)

        cur_day_of_year = (total_days % d_per_year) + 1
        cur_year = total_days // d_per_year

        # Минуты берем из реального времени (или тоже масштабируем?)
        # Если мы масштабируем часы, то и минуты должны масштабироваться в рамках часа.
        # scaled_delta_seconds % 3600 -> секунды в текущем часу вселенной
        cur_minute = int((scaled_delta_seconds % 3600) / 60)
        # Секунды также масштабируем
        cur_second = int(scaled_delta_seconds % 60)
        # Если мы просто хотим "красивое" время, можно брать реальные минуты
        # но если масштаб большой (1 реальная минута = 1 день), то минуты реальные не имеют смысла.
        # Поэтому берем масштабные.

        epoch = universe.universe_epoch_name or "н.э."

        display = f"{cur_hour:02d}:{cur_minute:02d}, {cur_day_of_year} день {cur_year} года {epoch}"

        return {
            "year": cur_year,
            "day": cur_day_of_year,
            "hour": cur_hour,
            "minute": cur_minute,
            "second": cur_second,
            "epoch": epoch,
            "display": display,
            "real_now": now_real.isoformat()
        }

time_service = TimeService()
