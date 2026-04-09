from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CharacterBase(BaseModel):
    name: str
    description: str = ""
    role: str = ""
    traits: str = ""
    appearance: str = ""
    backstory: str = ""
    # Демографические данные
    age: Optional[int] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_universe_year: Optional[int] = None
    birth_universe_day: Optional[int] = None
    death_universe_year: Optional[int] = None
    death_universe_day: Optional[int] = None
    # Отношения
    relationships: Optional[str] = None
    # Навыки и способности
    profession: Optional[str] = None
    skills: Optional[str] = None
    abilities: Optional[str] = None
    # Мотивация и цели
    goals: Optional[str] = None
    fears: Optional[str] = None
    conflicts: Optional[str] = None
    character_values: Optional[str] = None
    # Речь и манеры
    speech_pattern: Optional[str] = None
    mannerisms: Optional[str] = None
    habits: Optional[str] = None
    # human — речь по возрасту (человек); ageless — речь не зависит от возраста (ИИ, робот)
    speech_development: Optional[str] = "human"
    enabled: bool = True

class CharacterCreate(CharacterBase):
    universe_id: Optional[int] = None  # API: universe (хранится как universe_id в БД)
    universe_id: Optional[int] = None  # обратная совместимость, маппится в universe_id

class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    traits: Optional[str] = None
    appearance: Optional[str] = None
    backstory: Optional[str] = None
    portrait_image_path: Optional[str] = None
    portrait_ai_prompt: Optional[str] = None
    ai_analysis: Optional[str] = None
    # Демографические данные
    age: Optional[int] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_universe_year: Optional[int] = None
    birth_universe_day: Optional[int] = None
    death_universe_year: Optional[int] = None
    death_universe_day: Optional[int] = None
    # Отношения
    relationships: Optional[str] = None
    # Навыки и способности
    profession: Optional[str] = None
    skills: Optional[str] = None
    abilities: Optional[str] = None
    # Мотивация и цели
    goals: Optional[str] = None
    fears: Optional[str] = None
    conflicts: Optional[str] = None
    character_values: Optional[str] = None
    # Речь и манеры
    speech_pattern: Optional[str] = None
    mannerisms: Optional[str] = None
    habits: Optional[str] = None
    speech_development: Optional[str] = None
    enabled: Optional[bool] = None

class Character(CharacterBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    portrait_image_path: Optional[str] = None
    portrait_ai_prompt: Optional[str] = None
    ai_analysis: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class CharacterKnowledgeBase(BaseModel):
    target_type: str  # character, event, location, concept
    target_id: int
    knowledge_level: str  # none, rumors, superficial, good, complete
    source_type: Optional[str] = None  # participated, heard, read, learned_from
    source_id: Optional[int] = None
    notes: Optional[str] = None

class CharacterKnowledgeCreate(CharacterKnowledgeBase):
    pass

class CharacterKnowledgeUpdate(BaseModel):
    knowledge_level: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    notes: Optional[str] = None

class CharacterKnowledge(CharacterKnowledgeBase):
    id: int
    character_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
