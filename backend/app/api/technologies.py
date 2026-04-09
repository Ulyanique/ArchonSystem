from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.technology import TechnologySchema, TechnologyCreate, TechnologyUpdate, ArtifactSchema, ArtifactCreate, ArtifactUpdate
from app.repositories import technology as tech_repo

router = APIRouter(prefix="/universes/{universe_id}", tags=["technologies_artifacts"])

# Technologies
@router.get("/technologies", response_model=List[TechnologySchema])
async def list_technologies(universe_id: int, db: AsyncSession = Depends(get_db)):
    return await tech_repo.get_technologies(db, universe_id)

@router.post("/technologies", response_model=TechnologySchema)
async def create_technology(universe_id: int, tech: TechnologyCreate, db: AsyncSession = Depends(get_db)):
    return await tech_repo.create_technology(db, universe_id, tech)

@router.get("/technologies/{tech_id}", response_model=TechnologySchema)
async def get_technology(universe_id: int, tech_id: int, db: AsyncSession = Depends(get_db)):
    db_tech = await tech_repo.get_technology(db, tech_id)
    if not db_tech or db_tech.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Технология не найдена")
    return db_tech

@router.put("/technologies/{tech_id}", response_model=TechnologySchema)
async def update_technology(universe_id: int, tech_id: int, tech: TechnologyUpdate, db: AsyncSession = Depends(get_db)):
    db_tech = await tech_repo.update_technology(db, tech_id, tech)
    if not db_tech or db_tech.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Технология не найдена")
    return db_tech

@router.delete("/technologies/{tech_id}")
async def delete_technology(universe_id: int, tech_id: int, db: AsyncSession = Depends(get_db)):
    success = await tech_repo.delete_technology(db, tech_id)
    if not success:
        raise HTTPException(status_code=404, detail="Технология не найдена")
    return {"message": "Технология удалена"}

# Artifacts
@router.get("/artifacts", response_model=List[ArtifactSchema])
async def list_artifacts(universe_id: int, db: AsyncSession = Depends(get_db)):
    return await tech_repo.get_artifacts(db, universe_id)

@router.post("/artifacts", response_model=ArtifactSchema)
async def create_artifact(universe_id: int, artifact: ArtifactCreate, db: AsyncSession = Depends(get_db)):
    return await tech_repo.create_artifact(db, universe_id, artifact)

@router.get("/artifacts/{artifact_id}", response_model=ArtifactSchema)
async def get_artifact(universe_id: int, artifact_id: int, db: AsyncSession = Depends(get_db)):
    db_artifact = await tech_repo.get_artifact(db, artifact_id)
    if not db_artifact or db_artifact.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Артефакт не найден")
    return db_artifact

@router.put("/artifacts/{artifact_id}", response_model=ArtifactSchema)
async def update_artifact(universe_id: int, artifact_id: int, artifact: ArtifactUpdate, db: AsyncSession = Depends(get_db)):
    db_artifact = await tech_repo.update_artifact(db, artifact_id, artifact)
    if not db_artifact or db_artifact.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Артефакт не найден")
    return db_artifact

@router.delete("/artifacts/{artifact_id}")
async def delete_artifact(universe_id: int, artifact_id: int, db: AsyncSession = Depends(get_db)):
    success = await tech_repo.delete_artifact(db, artifact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Артефакт не найден")
    return {"message": "Артефакт удален"}
