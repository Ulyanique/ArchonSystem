from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class SceneBeatBase(BaseModel):
    title: str = ""
    description: str = ""
    content: str = ""
    sort_order: int = 0
    enabled: bool = True
    collapsed: bool = False


class SceneBeatCreate(SceneBeatBase):
    pass


class SceneBeatUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    sort_order: Optional[int] = None
    enabled: Optional[bool] = None
    collapsed: Optional[bool] = None


class SceneBeat(SceneBeatBase):
    id: int
    chapter_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SceneBeatReorderBody(BaseModel):
    beat_ids: list[int]  # порядок id битов после перетаскивания


class SceneBeatMoveBody(BaseModel):
    target_chapter_id: int
    insert_index: int = 0  # 0 = в начало целевой главы
