from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models.technology import Technology, Artifact
from app.schemas.technology import TechnologyCreate, TechnologyUpdate, ArtifactCreate, ArtifactUpdate
from app.repositories.universe import _touch_universe
from app.services.rag import rag_service


def _tech_content(tech: Technology) -> str:
    parts = [tech.name or "", tech.description or "", tech.tech_level or "", tech.principles or "", tech.application or ""]
    return " ".join(p for p in parts if p).strip()


# Technology
async def get_technologies(db: AsyncSession, universe_id: int) -> List[Technology]:
    result = await db.execute(select(Technology).filter(Technology.universe_id == universe_id))
    return result.scalars().all()

async def get_technology(db: AsyncSession, tech_id: int) -> Optional[Technology]:
    result = await db.execute(select(Technology).filter(Technology.id == tech_id))
    return result.scalars().first()

async def create_technology(db: AsyncSession, universe_id: int, tech: TechnologyCreate) -> Technology:
    db_tech = Technology(**tech.model_dump(), universe_id=universe_id)
    db.add(db_tech)
    await db.commit()
    await db.refresh(db_tech)
    await _touch_universe(universe_id)
    content = _tech_content(db_tech)
    if content:
        rag_service.add_document(
            universe_id=universe_id,
            doc_id=f"technology_{db_tech.id}",
            content=content,
            metadata={"type": "technology", "title": db_tech.name, "entity_type": "technology", "entity_id": db_tech.id},
        )
    return db_tech

async def update_technology(db: AsyncSession, tech_id: int, tech: TechnologyUpdate) -> Optional[Technology]:
    db_tech = await get_technology(db, tech_id)
    if db_tech:
        for key, value in tech.model_dump(exclude_unset=True).items():
            setattr(db_tech, key, value)
        await db.commit()
        await db.refresh(db_tech)
        await _touch_universe(db_tech.universe_id)
        content = _tech_content(db_tech)
        if content:
            rag_service.add_document(
                universe_id=db_tech.universe_id,
                doc_id=f"technology_{db_tech.id}",
                content=content,
                metadata={"type": "technology", "title": db_tech.name, "entity_type": "technology", "entity_id": db_tech.id},
            )
    return db_tech

async def delete_technology(db: AsyncSession, tech_id: int) -> bool:
    db_tech = await get_technology(db, tech_id)
    if db_tech:
        universe_id = db_tech.universe_id
        rag_service.remove_document(universe_id, f"technology_{tech_id}")
        await db.delete(db_tech)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False

def _artifact_content(artifact: Artifact) -> str:
    parts = [artifact.name or "", artifact.description or "", artifact.artifact_type or "", artifact.origin or "", artifact.abilities or ""]
    return " ".join(p for p in parts if p).strip()


# Artifact
async def get_artifacts(db: AsyncSession, universe_id: int) -> List[Artifact]:
    result = await db.execute(select(Artifact).filter(Artifact.universe_id == universe_id))
    return result.scalars().all()

async def get_artifact(db: AsyncSession, artifact_id: int) -> Optional[Artifact]:
    result = await db.execute(select(Artifact).filter(Artifact.id == artifact_id))
    return result.scalars().first()

async def create_artifact(db: AsyncSession, universe_id: int, artifact: ArtifactCreate) -> Artifact:
    db_artifact = Artifact(**artifact.model_dump(), universe_id=universe_id)
    db.add(db_artifact)
    await db.commit()
    await db.refresh(db_artifact)
    await _touch_universe(universe_id)
    content = _artifact_content(db_artifact)
    if content:
        rag_service.add_document(
            universe_id=universe_id,
            doc_id=f"artifact_{db_artifact.id}",
            content=content,
            metadata={"type": "artifact", "title": db_artifact.name, "entity_type": "artifact", "entity_id": db_artifact.id},
        )
    return db_artifact

async def update_artifact(db: AsyncSession, artifact_id: int, artifact: ArtifactUpdate) -> Optional[Artifact]:
    db_artifact = await get_artifact(db, artifact_id)
    if db_artifact:
        for key, value in artifact.model_dump(exclude_unset=True).items():
            setattr(db_artifact, key, value)
        await db.commit()
        await db.refresh(db_artifact)
        await _touch_universe(db_artifact.universe_id)
        content = _artifact_content(db_artifact)
        if content:
            rag_service.add_document(
                universe_id=db_artifact.universe_id,
                doc_id=f"artifact_{db_artifact.id}",
                content=content,
                metadata={"type": "artifact", "title": db_artifact.name, "entity_type": "artifact", "entity_id": db_artifact.id},
            )
    return db_artifact

async def delete_artifact(db: AsyncSession, artifact_id: int) -> bool:
    db_artifact = await get_artifact(db, artifact_id)
    if db_artifact:
        universe_id = db_artifact.universe_id
        rag_service.remove_document(universe_id, f"artifact_{artifact_id}")
        await db.delete(db_artifact)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False
