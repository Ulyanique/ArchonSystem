from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import re
from app.models import WikiArticle
from app.schemas import WikiArticleCreate, WikiArticleUpdate

def _slugify(text: str) -> str:
    """Генерация slug из заголовка."""
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s or "article"

# === WikiArticle Repository ===
async def get_wiki_articles(db: AsyncSession, universe_id: int) -> List[WikiArticle]:
    result = await db.execute(select(WikiArticle).filter(WikiArticle.universe_id == universe_id).order_by(WikiArticle.title))
    return result.scalars().all()

async def get_wiki_article(db: AsyncSession, article_id: int) -> Optional[WikiArticle]:
    result = await db.execute(select(WikiArticle).filter(WikiArticle.id == article_id))
    return result.scalars().first()

async def get_wiki_article_by_slug(db: AsyncSession, universe_id: int, slug: str) -> Optional[WikiArticle]:
    result = await db.execute(select(WikiArticle).filter(WikiArticle.universe_id == universe_id, WikiArticle.slug == slug))
    return result.scalars().first()

async def create_wiki_article(db: AsyncSession, universe_id: int, article: WikiArticleCreate) -> WikiArticle:
    slug = article.slug or _slugify(article.title)
    base_slug = slug
    n = 0
    while True:
        existing = await get_wiki_article_by_slug(db, universe_id, slug)
        if not existing:
            break
        n += 1
        slug = f"{base_slug}-{n}"

    data = article.model_dump(exclude={"slug"})
    data["universe_id"] = universe_id
    data["slug"] = slug
    db_article = WikiArticle(**data)
    db.add(db_article)
    await db.commit()
    await db.refresh(db_article)
    return db_article

async def update_wiki_article(db: AsyncSession, article_id: int, article: WikiArticleUpdate) -> Optional[WikiArticle]:
    db_article = await get_wiki_article(db, article_id)
    if db_article:
        update_data = article.model_dump(exclude_unset=True)
        if "slug" in update_data and update_data["slug"]:
            # проверка уникальности slug в рамках вселенной
            result = await db.execute(select(WikiArticle).filter(
                WikiArticle.universe_id == db_article.universe_id,
                WikiArticle.slug == update_data["slug"],
                WikiArticle.id != article_id
            ))
            other = result.scalars().first()
            if other:
                update_data.pop("slug")
        for key, value in update_data.items():
            setattr(db_article, key, value)
        await db.commit()
        await db.refresh(db_article)
    return db_article

async def delete_wiki_article(db: AsyncSession, article_id: int) -> bool:
    db_article = await get_wiki_article(db, article_id)
    if db_article:
        await db.delete(db_article)
        await db.commit()
        return True
    return False
