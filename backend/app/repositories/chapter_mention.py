"""Репозиторий упоминаний сущностей в главах (покрытие мира)."""
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Literal

from app.models import ChapterMention, Chapter, Character, Location, Technology, Artifact, Faction

EntityType = Literal["character", "location", "technology", "artifact", "faction"]

ENTITY_TYPES: List[str] = ["character", "location", "technology", "artifact", "faction"]


async def add_mention(db: AsyncSession, chapter_id: int, entity_type: str, entity_id: int) -> ChapterMention:
    """Добавить упоминание сущности в главе."""
    mention = ChapterMention(chapter_id=chapter_id, entity_type=entity_type, entity_id=entity_id)
    db.add(mention)
    await db.commit()
    await db.refresh(mention)
    return mention


async def remove_mention(db: AsyncSession, chapter_id: int, entity_type: str, entity_id: int) -> bool:
    """Удалить упоминание."""
    result = await db.execute(
        delete(ChapterMention).where(
            ChapterMention.chapter_id == chapter_id,
            ChapterMention.entity_type == entity_type,
            ChapterMention.entity_id == entity_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


async def get_mentions_for_chapter(db: AsyncSession, chapter_id: int) -> List[ChapterMention]:
    """Список упоминаний для одной главы."""
    result = await db.execute(
        select(ChapterMention).where(ChapterMention.chapter_id == chapter_id)
    )
    return list(result.scalars().all())


async def get_mention_ids_by_chapter(db: AsyncSession, universe_id: int) -> dict:
    """По главам вселенной: { chapter_id: [ (entity_type, entity_id), ... ] }."""
    chapters = await db.execute(
        select(Chapter.id).where(Chapter.universe_id == universe_id)
    )
    chapter_ids = [r[0] for r in chapters.all()]
    if not chapter_ids:
        return {}

    result = await db.execute(
        select(ChapterMention.chapter_id, ChapterMention.entity_type, ChapterMention.entity_id).where(
            ChapterMention.chapter_id.in_(chapter_ids)
        )
    )
    rows = result.all()
    out: dict = {cid: [] for cid in chapter_ids}
    for cid, etype, eid in rows:
        out[cid].append((etype, eid))
    return out


async def get_coverage_stats(db: AsyncSession, universe_id: int) -> dict:
    """
    Статистика покрытия: какие сущности в каких главах фигурируют.
    Возвращает:
      chapters: [ { id, title, chapter_number, mention_counts } ]
      by_entity: { character: [ { id, name, chapter_ids } ], location: [...], ... }
      unused: { character: [id,...], ... } — сущности без ни одного упоминания
    """
    chapters_res = await db.execute(
        select(Chapter).where(Chapter.universe_id == universe_id).order_by(Chapter.chapter_number)
    )
    chapters_list = chapters_res.scalars().all()
    chapter_ids = [c.id for c in chapters_list]

    mentions_res = await db.execute(
        select(ChapterMention.chapter_id, ChapterMention.entity_type, ChapterMention.entity_id).where(
            ChapterMention.chapter_id.in_(chapter_ids)
        )
    )
    mentions = mentions_res.all()

    # По главам: список (entity_type, entity_id)
    by_chapter: dict = {c.id: [] for c in chapters_list}
    for cid, etype, eid in mentions:
        by_chapter[cid].append((etype, eid))

    # Собираем id всех сущностей по типам из моделей
    all_entities: dict = {
        "character": [],
        "location": [],
        "technology": [],
        "artifact": [],
        "faction": [],
    }
    chars = await db.execute(select(Character.id, Character.name).where(Character.universe_id == universe_id))
    all_entities["character"] = [{"id": r[0], "name": r[1] or ""} for r in chars.all()]
    locs = await db.execute(select(Location.id, Location.name).where(Location.universe_id == universe_id))
    all_entities["location"] = [{"id": r[0], "name": r[1] or ""} for r in locs.all()]
    techs = await db.execute(select(Technology.id, Technology.name).where(Technology.universe_id == universe_id))
    all_entities["technology"] = [{"id": r[0], "name": r[1] or ""} for r in techs.all()]
    arts = await db.execute(select(Artifact.id, Artifact.name).where(Artifact.universe_id == universe_id))
    all_entities["artifact"] = [{"id": r[0], "name": r[1] or ""} for r in arts.all()]
    facs = await db.execute(select(Faction.id, Faction.name).where(Faction.universe_id == universe_id))
    all_entities["faction"] = [{"id": r[0], "name": r[1] or ""} for r in facs.all()]

    # entity_type -> entity_id -> [chapter_ids]
    mentioned: dict = {t: {} for t in ENTITY_TYPES}
    for cid, etype, eid in mentions:
        if eid not in mentioned[etype]:
            mentioned[etype][eid] = []
        mentioned[etype][eid].append(cid)

    by_entity = {}
    unused = {}
    for etype in ENTITY_TYPES:
        by_entity[etype] = []
        unused[etype] = []
        for ent in all_entities[etype]:
            eid = ent["id"]
            ch_ids = mentioned[etype].get(eid, [])
            by_entity[etype].append({
                "id": eid,
                "name": ent["name"],
                "chapter_ids": ch_ids,
            })
            if not ch_ids:
                unused[etype].append(eid)

    chapters_out = []
    for c in chapters_list:
        ch_mentions = by_chapter.get(c.id, [])
        counts = {}
        for etype in ENTITY_TYPES:
            counts[etype] = sum(1 for t, _ in ch_mentions if t == etype)
        chapters_out.append({
            "id": c.id,
            "title": c.title,
            "chapter_number": c.chapter_number,
            "mention_counts": counts,
            "mentions": [{"entity_type": t, "entity_id": eid} for t, eid in ch_mentions],
        })

    return {
        "chapters": chapters_out,
        "by_entity": by_entity,
        "unused": unused,
    }
