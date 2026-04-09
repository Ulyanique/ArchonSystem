from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class ConceptArtBase(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "other"
    tags: Optional[str] = ""
    sort_order: Optional[int] = 0

class ConceptArtCreate(ConceptArtBase):
    pass

class ConceptArtUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    sort_order: Optional[int] = None
    image_path: Optional[str] = None

class ConceptArtGenerateRequest(BaseModel):
    """Тело запроса на генерацию концепт-арта по описанию."""
    title: str
    description: str  # промпт/контекст для генерации изображения
    category: Optional[str] = "other"
    tags: Optional[str] = ""
    aspect_ratio: Optional[str] = "landscape"  # landscape | portrait | square


class ConceptArtGenerateAutoRequest(BaseModel):
    """Тело запроса на полностью автоматическую генерацию (опционально)."""
    aspect_ratio: Optional[str] = "landscape"  # landscape | portrait | square


class ConceptArtSchema(ConceptArtBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    image_path: str
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    created_at: datetime
    updated_at: datetime
