"""API бэкапа и восстановления вселенной (архив папки + метаданные)."""
import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import DATA_DIR
from app.database import get_db, get_master_db, _universe_engines, _universe_db_inited
from app.services import knowledge
from app.schemas import UniverseCreate

router = APIRouter(prefix="/universes", tags=["backup"])

MANIFEST_FILENAME = "archon_manifest.json"


def _universe_dir(universe_id: int) -> Path:
    return DATA_DIR / "universes" / str(universe_id)


@router.get("/{universe_id}/backup")
async def create_backup(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Создать архив вселенной (БД + файлы) для скачивания."""
    universe = await knowledge.get_universe(universe_id, master_db)
    if not universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")

    u_dir = _universe_dir(universe_id)
    if not u_dir.exists():
        raise HTTPException(status_code=404, detail="Папка вселенной не найдена")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Метаданные для восстановления
        manifest = {
            "title": universe.title,
            "description": getattr(universe, "description", "") or "",
            "genre": getattr(universe, "genre", "") or "",
            "universe_type": getattr(universe, "universe_type", "") or "",
        }
        zf.writestr(MANIFEST_FILENAME, json.dumps(manifest, ensure_ascii=False, indent=2))

        for path in u_dir.rglob("*"):
            if path.is_file():
                arcname = path.relative_to(u_dir)
                zf.write(path, arcname)

    buffer.seek(0)
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in universe.title)[:80]
    filename = f"{safe_title}_backup.zip"

    return StreamingResponse(
        io.BytesIO(buffer.getvalue()),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: AsyncSession = Depends(get_master_db),
):
    """Восстановить вселенную из архива (zip). Создаётся новая вселенная с данными из архива."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Нужен файл .zip")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Файл пустой")

    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            manifest_data = None
            if MANIFEST_FILENAME in zf.namelist():
                manifest_data = json.loads(zf.read(MANIFEST_FILENAME).decode("utf-8"))

            if title:
                restore_title = title
            elif manifest_data and manifest_data.get("title"):
                restore_title = manifest_data["title"]
            else:
                restore_title = "Восстановленная вселенная"

            create_schema = UniverseCreate(
                title=restore_title,
                description=(manifest_data or {}).get("description", ""),
                genre=(manifest_data or {}).get("genre", ""),
                universe_type=(manifest_data or {}).get("universe_type", ""),
            )
            new_universe = await knowledge.create_universe(db, create_schema)
            new_id = new_universe.id

            u_dir = _universe_dir(new_id)
            u_dir.mkdir(parents=True, exist_ok=True)

            for name in zf.namelist():
                if name == MANIFEST_FILENAME:
                    continue
                target = u_dir / name
                if name.endswith("/"):
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(zf.read(name))

            # Сброс кэша движка БД, чтобы следующие запросы использовали восстановленную БД
            _universe_db_inited.discard(new_id)
            _universe_engines.pop(new_id, None)

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Некорректный zip-архив")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления: {e!s}")

    return {
        "message": "Вселенная восстановлена",
        "universe_id": new_id,
        "title": restore_title,
    }
