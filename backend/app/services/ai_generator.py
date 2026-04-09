from app.services.generators.character_gen import CharacterGenerator
from app.services.generators.location_gen import LocationGenerator
from app.services.generators.story_gen import StoryGenerator
from app.services.generators.misc_gen import MiscGenerator

class AIGeneratorService(CharacterGenerator, LocationGenerator, StoryGenerator, MiscGenerator):
    """Сервис для AI генерации случайного контента, декомпозированный на специализированные генераторы."""
    pass

# Глобальный экземпляр
ai_generator_service = AIGeneratorService()
