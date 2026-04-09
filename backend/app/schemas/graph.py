from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List

class GraphNode(BaseModel):
    id: str  # format: "type_id" e.g. "character_1"
    label: str
    type: str
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    position: Optional[dict] = None  # { "x": float, "y": float } если сохранён
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class GraphLink(BaseModel):
    source: str  # format: "type_id"
    target: str  # format: "type_id"
    label: str
    type: str

class GraphData(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]
