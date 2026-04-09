from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from typing import List, Optional, Dict
import math
from app.models import Link, Universe, Character, Location, Chapter, Note, GraphLayout, Galaxy, StarSystem, CelestialBody
from app.schemas import LinkCreate, LinkUpdate, GraphNode, GraphLink, GraphData

async def get_links(db: AsyncSession, universe_id: int) -> List[Link]:
    """Получить все связи вселенной"""
    result = await db.execute(select(Link).filter(Link.universe_id == universe_id))
    return result.scalars().all()

async def get_link(db: AsyncSession, link_id: int) -> Optional[Link]:
    """Получить связь по ID"""
    result = await db.execute(select(Link).filter(Link.id == link_id))
    return result.scalars().first()

async def create_link(db: AsyncSession, link: LinkCreate) -> Link:
    """Создать связь"""
    data = link.model_dump()
    data["universe_id"] = data.pop("universe_id", data.get("universe_id"))
    db_link = Link(**data)
    db.add(db_link)
    await db.commit()
    await db.refresh(db_link)
    return db_link

async def update_link(db: AsyncSession, link_id: int, link: LinkUpdate) -> Optional[Link]:
    """Обновить связь"""
    result = await db.execute(select(Link).filter(Link.id == link_id))
    db_link = result.scalars().first()
    if db_link:
        update_data = link.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_link, key, value)
        await db.commit()
        await db.refresh(db_link)
    return db_link

async def delete_link(db: AsyncSession, link_id: int) -> bool:
    """Удалить связь"""
    result = await db.execute(select(Link).filter(Link.id == link_id))
    db_link = result.scalars().first()
    if db_link:
        await db.delete(db_link)
        await db.commit()
        return True
    return False

async def get_layout(db: AsyncSession, universe_id: int) -> Dict[str, dict]:
    """Получить сохранённые позиции узлов графа: node_id -> {x, y}."""
    result = await db.execute(select(GraphLayout).filter(GraphLayout.universe_id == universe_id))
    rows = result.scalars().all()
    return {r.node_id: {"x": r.x, "y": r.y} for r in rows}


async def save_layout(db: AsyncSession, universe_id: int, nodes: List[dict]) -> None:
    """Сохранить позиции узлов. nodes: [ { id, position: { x, y } }, ... ]."""
    for item in nodes:
        nid = item.get("id")
        pos = item.get("position")
        if not nid or not pos or "x" not in pos or "y" not in pos:
            continue
        result = await db.execute(select(GraphLayout).filter(GraphLayout.universe_id == universe_id, GraphLayout.node_id == nid))
        row = result.scalars().first()
        if row:
            row.x = float(pos["x"])
            row.y = float(pos["y"])
        else:
            db.add(GraphLayout(universe_id=universe_id, node_id=nid, x=float(pos["x"]), y=float(pos["y"])))
    await db.commit()


async def get_graph_data(db: AsyncSession, universe_id: int, master_db: AsyncSession) -> GraphData:
    """Получить данные для графа знаний (узлы с позициями, если сохранены)."""
    # Note: access characters/locations/etc might need eager loading or separate queries
    # Universe находится в master database, а не в universe database
    result = await master_db.execute(select(Universe).filter(Universe.id == universe_id))
    universe = result.scalars().first()
    if not universe:
        return GraphData(nodes=[], links=[])

    layout = await get_layout(db, universe_id)
    nodes = []

    # Eager loading would be better, but let's do separate queries to be safe in async
    chars_res = await db.execute(select(Character).filter(Character.universe_id == universe_id))
    for char in chars_res.scalars().all():
        nid = f"character_{char.id}"
        nodes.append(GraphNode(id=nid, label=char.name, type="character", universe_id=universe_id, position=layout.get(nid)))

    locs_res = await db.execute(select(Location).filter(Location.universe_id == universe_id))
    for loc in locs_res.scalars().all():
        nid = f"location_{loc.id}"
        nodes.append(GraphNode(id=nid, label=loc.name, type="location", universe_id=universe_id, position=layout.get(nid)))

    chapters_res = await db.execute(select(Chapter).filter(Chapter.universe_id == universe_id))
    for ch in chapters_res.scalars().all():
        nid = f"chapter_{ch.id}"
        nodes.append(GraphNode(id=nid, label=f"Глава {ch.chapter_number}: {ch.title}", type="chapter", universe_id=universe_id, position=layout.get(nid)))

    notes_res = await db.execute(select(Note).filter(Note.universe_id == universe_id))
    for note in notes_res.scalars().all():
        nid = f"note_{note.id}"
        nodes.append(GraphNode(id=nid, label=note.title, type="note", universe_id=universe_id, position=layout.get(nid)))
    
    # Добавляем связи
    links = []
    db_links = await get_links(db, universe_id)
    
    type_labels = {
        "character": "👤", "location": "🗺️", "chapter": "📖", "note": "📝"
    }
    
    link_type_labels = {
        "related": "связан", "friend": "друг", "enemy": "враг", "family": "семья",
        "loves": "любит", "hates": "ненавидит", "located_in": "находится в",
        "appears_in": "появляется в", "knows": "знает", "works_at": "работает в",
        "lives_at": "живёт в", "visited": "посетил", "mentioned_in": "упомянут в", "other": "другое"
    }
    
    for db_link in db_links:
        source_icon = type_labels.get(db_link.source_type, "")
        target_icon = type_labels.get(db_link.target_type, "")
        link_label = link_type_labels.get(db_link.link_type, db_link.link_type)
        
        links.append(GraphLink(
            source=f"{db_link.source_type}_{db_link.source_id}",
            target=f"{db_link.target_type}_{db_link.target_id}",
            label=f"{source_icon} {link_label} {target_icon}",
            type=db_link.link_type
        ))
    
    return GraphData(nodes=nodes, links=links)


def _layer_position(layer: int, index: int, total: int, center_x: float = 500, center_y: float = 400) -> dict:
    """Позиция узла в кольце слоя (для графа пространства)."""
    if total <= 0:
        return {"x": center_x, "y": center_y}
    radius = 120 + layer * 140
    angle = (2 * math.pi * index) / total
    return {"x": center_x + radius * math.cos(angle), "y": center_y + radius * math.sin(angle)}


async def get_graph_data_space(db: AsyncSession, universe_id: int, master_db: AsyncSession) -> GraphData:
    """
    Граф пространства (как в Obsidian): Вселенная → Галактики → Звёздные системы →
    Небесные тела (планеты, спутники, станции) → Локации.
    Связанность по иерархии и по celestial_body_id у локаций, parent_body_id у спутников.
    """
    result = await master_db.execute(select(Universe).filter(Universe.id == universe_id))
    universe = result.scalars().first()
    if not universe:
        return GraphData(nodes=[], links=[])

    nodes: List[GraphNode] = []
    links: List[GraphLink] = []
    center_x, center_y = 500.0, 400.0

    # Узел вселенной (центр)
    unode_id = f"universe_{universe_id}"
    nodes.append(GraphNode(
        id=unode_id, label=universe.title or "Вселенная", type="universe", universe_id=universe_id,
        position={"x": center_x, "y": center_y}
    ))

    galaxies_res = await db.execute(select(Galaxy).filter(Galaxy.universe_id == universe_id).order_by(Galaxy.id))
    galaxies = galaxies_res.scalars().all()
    for i, g in enumerate(galaxies):
        nid = f"galaxy_{g.id}"
        nodes.append(GraphNode(
            id=nid, label=g.name, type="galaxy", universe_id=universe_id,
            position=_layer_position(1, i, max(len(galaxies), 1), center_x, center_y)
        ))
        links.append(GraphLink(source=unode_id, target=nid, label="содержит", type="contains"))

    systems_res = await db.execute(
        select(StarSystem).filter(StarSystem.universe_id == universe_id).order_by(StarSystem.galaxy_id, StarSystem.id)
    )
    systems = systems_res.scalars().all()
    systems_by_galaxy: Dict[int, List] = {}
    for s in systems:
        systems_by_galaxy.setdefault(s.galaxy_id, []).append(s)
    layer2_idx = 0
    layer2_total = len(systems)
    for g in galaxies:
        for s in systems_by_galaxy.get(g.id, []):
            sid = f"star_system_{s.id}"
            nodes.append(GraphNode(
                id=sid, label=s.name, type="star_system", universe_id=universe_id,
                position=_layer_position(2, layer2_idx, max(layer2_total, 1), center_x, center_y)
            ))
            links.append(GraphLink(source=f"galaxy_{g.id}", target=sid, label="содержит", type="contains"))
            layer2_idx += 1

    bodies_res = await db.execute(
        select(CelestialBody).filter(CelestialBody.universe_id == universe_id).order_by(
            CelestialBody.star_system_id, CelestialBody.parent_body_id or 0, CelestialBody.id
        )
    )
    bodies = bodies_res.scalars().all()
    bodies_by_system: Dict[int, List] = {}
    bodies_with_parent: Dict[int, List] = {}
    for b in bodies:
        if b.parent_body_id:
            bodies_with_parent.setdefault(b.parent_body_id, []).append(b)
        else:
            bodies_by_system.setdefault(b.star_system_id, []).append(b)
    layer3_idx = 0
    layer3_total = len(bodies)

    def add_bodies_list(bodies_list: list, source_id: str):
        nonlocal layer3_idx
        for b in bodies_list:
            bid = f"celestial_body_{b.id}"
            nodes.append(GraphNode(
                id=bid, label=f"{b.name}" + (f" ({b.body_type})" if b.body_type else ""),
                type="celestial_body", universe_id=universe_id,
                position=_layer_position(3, layer3_idx, max(layer3_total, 1), center_x, center_y)
            ))
            links.append(GraphLink(source=source_id, target=bid, label="содержит", type="contains"))
            layer3_idx += 1
            add_bodies_list(bodies_with_parent.get(b.id, []), bid)

    for s in systems:
        add_bodies_list(bodies_by_system.get(s.id, []), f"star_system_{s.id}")

    locs_res = await db.execute(select(Location).filter(Location.universe_id == universe_id, Location.enabled != False))
    locations = locs_res.scalars().all()
    locs_by_body: Dict[Optional[int], List] = {}
    for loc in locations:
        bid = getattr(loc, "celestial_body_id", None)
        locs_by_body.setdefault(bid, []).append(loc)
    layer4_idx = 0
    layer4_total = len(locations)
    for loc in locs_by_body.get(None, []):
        lid = f"location_{loc.id}"
        nodes.append(GraphNode(
            id=lid, label=loc.name, type="location", universe_id=universe_id,
            position=_layer_position(4, layer4_idx, max(layer4_total, 1), center_x, center_y)
        ))
        links.append(GraphLink(source=unode_id, target=lid, label="локация", type="located_in"))
        layer4_idx += 1
    for b in bodies:
        for loc in locs_by_body.get(b.id, []):
            lid = f"location_{loc.id}"
            nodes.append(GraphNode(
                id=lid, label=loc.name, type="location", universe_id=universe_id,
                position=_layer_position(4, layer4_idx, max(layer4_total, 1), center_x, center_y)
            ))
            links.append(GraphLink(source=f"celestial_body_{b.id}", target=lid, label="находится на", type="located_in"))
            layer4_idx += 1

    return GraphData(nodes=nodes, links=links)


async def get_suggested_links(db: AsyncSession, universe_id: int, element_type: str, element_id: int) -> List[dict]:
    """Получить предложения по связям на основе анализа текста"""
    suggestions = []
    
    # Получаем элемент
    if element_type == "character":
        res = await db.execute(select(Character).filter(Character.id == element_id, Character.universe_id == universe_id))
        element = res.scalars().first()
    elif element_type == "location":
        res = await db.execute(select(Location).filter(Location.id == element_id, Location.universe_id == universe_id))
        element = res.scalars().first()
    elif element_type == "chapter":
        res = await db.execute(select(Chapter).filter(Chapter.id == element_id, Chapter.universe_id == universe_id))
        element = res.scalars().first()
    elif element_type == "note":
        res = await db.execute(select(Note).filter(Note.id == element_id, Note.universe_id == universe_id))
        element = res.scalars().first()
    else:
        return []
    
    if not element:
        return []
    
    # Простой анализ
    chars_res = await db.execute(select(Character).filter(Character.universe_id == universe_id, Character.id != element_id))
    all_characters = chars_res.scalars().all()
    locs_res = await db.execute(select(Location).filter(Location.universe_id == universe_id, Location.id != element_id))
    all_locations = locs_res.scalars().all()
    
    element_text = f"{getattr(element, 'description', '')} {getattr(element, 'content', '')} {getattr(element, 'backstory', '')}".lower()
    
    for char in all_characters:
        if char.name.lower() in element_text:
            stmt = select(Link).filter(
                Link.universe_id == universe_id,
                or_(
                    (Link.source_type == element_type) & (Link.source_id == element_id) & (Link.target_type == "character") & (Link.target_id == char.id),
                    (Link.target_type == element_type) & (Link.target_id == element_id) & (Link.source_type == "character") & (Link.source_id == char.id)
                )
            )
            existing_res = await db.execute(stmt)
            if not existing_res.scalars().first():
                suggestions.append({
                    "target_type": "character", "target_id": char.id, "target_name": char.name,
                    "suggested_type": "related", "reason": f"Упоминание в тексте"
                })
    
    for loc in all_locations:
        if loc.name.lower() in element_text:
            stmt = select(Link).filter(
                Link.universe_id == universe_id,
                or_(
                    (Link.source_type == element_type) & (Link.source_id == element_id) & (Link.target_type == "location") & (Link.target_id == loc.id),
                    (Link.target_type == element_type) & (Link.target_id == element_id) & (Link.source_type == "location") & (Link.source_id == loc.id)
                )
            )
            existing_res = await db.execute(stmt)
            if not existing_res.scalars().first():
                suggestions.append({
                    "target_type": "location", "target_id": loc.id, "target_name": loc.name,
                    "suggested_type": "located_in" if element_type == "character" else "related",
                    "reason": f"Упоминание в тексте"
                })
    
    return suggestions[:10]

async def analyze_connectivity(db: AsyncSession, universe_id: int) -> Dict:
    """Анализ связанности сущностей вселенной"""
    from app.services import timeline as timeline_service
    from app.services import knowledge
    
    try:
        # Получаем все сущности
        characters = await knowledge.get_characters(db, universe_id)
        locations = await knowledge.get_locations(db, universe_id)
        events = await timeline_service.get_timeline_events(db, universe_id)
        links = await get_links(db, universe_id)
        
        # Строим граф связей
        char_connections = {char.id: set() for char in characters}
        loc_connections = {loc.id: set() for loc in locations}
        event_connections = {event.id: set() for event in events}
        
        # Анализируем связи через события
        for event in events:
            try:
                # Получаем ID персонажей из события
                event_char_ids = []
                if hasattr(event, 'characters') and event.characters:
                    event_char_ids = [c.id for c in event.characters]
            except (AttributeError, TypeError) as e:
                event_char_ids = []
            
            try:
                event_loc_id = getattr(event, 'location_id', None)
            except (AttributeError, TypeError):
                event_loc_id = None
            
            # Персонажи связаны через события
            for char_id in event_char_ids:
                if char_id in char_connections:
                    event_connections[event.id].add(('character', char_id))
                    char_connections[char_id].add(('event', event.id))
                    # Персонажи связаны друг с другом через события
                    for other_char_id in event_char_ids:
                        if other_char_id != char_id and other_char_id in char_connections:
                            char_connections[char_id].add(('character', other_char_id))
            
            # Локации связаны через события
            if event_loc_id and event_loc_id in loc_connections:
                event_connections[event.id].add(('location', event_loc_id))
                loc_connections[event_loc_id].add(('event', event.id))
                # Персонажи связаны с локациями через события
                for char_id in event_char_ids:
                    if char_id in char_connections:
                        char_connections[char_id].add(('location', event_loc_id))
                        loc_connections[event_loc_id].add(('character', char_id))
        
        # Анализируем явные связи (links)
        for link in links:
            try:
                source_id = link.source_id
                target_id = link.target_id
                source_type = link.source_type
                target_type = link.target_type
                
                if source_type == 'character' and target_type == 'character':
                    if source_id in char_connections and target_id in char_connections:
                        char_connections[source_id].add(('character', target_id))
                        char_connections[target_id].add(('character', source_id))
                elif source_type == 'location' and target_type == 'location':
                    if source_id in loc_connections and target_id in loc_connections:
                        loc_connections[source_id].add(('location', target_id))
                        loc_connections[target_id].add(('location', source_id))
                elif source_type == 'character' and target_type == 'location':
                    if source_id in char_connections and target_id in loc_connections:
                        char_connections[source_id].add(('location', target_id))
                        loc_connections[target_id].add(('character', source_id))
                elif source_type == 'location' and target_type == 'character':
                    if source_id in loc_connections and target_id in char_connections:
                        loc_connections[source_id].add(('character', target_id))
                        char_connections[target_id].add(('location', source_id))
            except (AttributeError, KeyError) as e:
                # Пропускаем некорректные связи
                continue
        
        # Находим изолированные сущности
        isolated_chars = [char.id for char in characters if len(char_connections[char.id]) == 0]
        isolated_locs = [loc.id for loc in locations if len(loc_connections[loc.id]) == 0]
        isolated_events = [event.id for event in events if len(event_connections[event.id]) == 0]
        
        # Находим слабо связанные сущности (1-2 связи)
        weakly_connected_chars = [char.id for char in characters if 1 <= len(char_connections[char.id]) <= 2]
        weakly_connected_locs = [loc.id for loc in locations if 1 <= len(loc_connections[loc.id]) <= 2]
        
        # Находим наиболее связанные сущности
        char_connection_counts = [(char.id, len(char_connections[char.id])) for char in characters]
        char_connection_counts.sort(key=lambda x: x[1], reverse=True)
        most_connected_chars = char_connection_counts[:5]
        
        loc_connection_counts = [(loc.id, len(loc_connections[loc.id])) for loc in locations]
        loc_connection_counts.sort(key=lambda x: x[1], reverse=True)
        most_connected_locs = loc_connection_counts[:5]
        
        # Статистика
        total_chars = len(characters)
        total_locs = len(locations)
        total_events = len(events)
        total_links = len(links)
        
        avg_char_connections = sum(len(char_connections[char.id]) for char in characters) / total_chars if total_chars > 0 else 0
        avg_loc_connections = sum(len(loc_connections[loc.id]) for loc in locations) / total_locs if total_locs > 0 else 0
        
        return {
            "statistics": {
                "total_characters": total_chars,
                "total_locations": total_locs,
                "total_events": total_events,
                "total_links": total_links,
                "avg_character_connections": round(avg_char_connections, 2),
                "avg_location_connections": round(avg_loc_connections, 2),
            },
            "isolated": {
                "characters": isolated_chars,
                "locations": isolated_locs,
                "events": isolated_events,
            },
            "weakly_connected": {
                "characters": weakly_connected_chars,
                "locations": weakly_connected_locs,
            },
            "most_connected": {
                "characters": [{"id": char_id, "connections": count} for char_id, count in most_connected_chars],
                "locations": [{"id": loc_id, "connections": count} for loc_id, count in most_connected_locs],
            },
            "connection_details": {
                "character_connections": {char_id: len(conns) for char_id, conns in char_connections.items()},
                "location_connections": {loc_id: len(conns) for loc_id, conns in loc_connections.items()},
            }
        }
    except Exception as e:
        import traceback
        raise Exception(f"Ошибка при анализе связанности: {str(e)}\n{traceback.format_exc()}")

async def check_temporal_consistency(db: AsyncSession, universe_id: int) -> Dict:
    """Проверка временной консистентности вселенной"""
    from app.services import timeline as timeline_service
    from app.services import knowledge
    
    issues = []
    
    try:
        characters = await knowledge.get_characters(db, universe_id)
        events = await timeline_service.get_timeline_events(db, universe_id)
        
        # Проверка: персонаж родился после смерти
        for char in characters:
            if hasattr(char, 'birth_universe_year') and hasattr(char, 'death_universe_year'):
                birth_year = getattr(char, 'birth_universe_year', None)
                death_year = getattr(char, 'death_universe_year', None)
                if birth_year and death_year and birth_year > death_year:
                    issues.append({
                        "type": "birth_after_death",
                        "severity": "high",
                        "entity_type": "character",
                        "entity_id": char.id,
                        "entity_name": char.name,
                        "description": f"Персонаж {char.name} родился ({birth_year}) после своей смерти ({death_year})"
                    })
        
        # Проверка: события после смерти персонажа
        for event in events:
            event_year = getattr(event, 'universe_year', None)
            if event_year:
                event_char_ids = [c.id for c in (event.characters if hasattr(event, 'characters') and event.characters else [])]
                for char_id in event_char_ids:
                    char = next((c for c in characters if c.id == char_id), None)
                    if char:
                        death_year = getattr(char, 'death_universe_year', None)
                        if death_year and event_year > death_year:
                            issues.append({
                                "type": "event_after_death",
                                "severity": "high",
                                "entity_type": "event",
                                "entity_id": event.id,
                                "entity_name": event.title,
                                "related_entity": {"type": "character", "id": char.id, "name": char.name},
                                "description": f"Событие '{event.title}' ({event_year}) произошло после смерти персонажа {char.name} ({death_year})"
                            })
        
        # Проверка: события до рождения персонажа (если это не событие рождения)
        for event in events:
            if getattr(event, 'event_type', None) == 'birth':
                continue
            event_year = getattr(event, 'universe_year', None)
            if event_year:
                event_char_ids = [c.id for c in (event.characters if hasattr(event, 'characters') and event.characters else [])]
                for char_id in event_char_ids:
                    char = next((c for c in characters if c.id == char_id), None)
                    if char:
                        birth_year = getattr(char, 'birth_universe_year', None)
                        if birth_year and event_year < birth_year:
                            issues.append({
                                "type": "event_before_birth",
                                "severity": "medium",
                                "entity_type": "event",
                                "entity_id": event.id,
                                "entity_name": event.title,
                                "related_entity": {"type": "character", "id": char.id, "name": char.name},
                                "description": f"Событие '{event.title}' ({event_year}) произошло до рождения персонажа {char.name} ({birth_year})"
                            })
        
        # Проверка: большие пропуски во времени между событиями
        events_with_dates = [e for e in events if getattr(e, 'universe_year', None) is not None]
        if len(events_with_dates) > 1:
            events_with_dates.sort(key=lambda e: getattr(e, 'universe_year', 0))
            for i in range(len(events_with_dates) - 1):
                year1 = getattr(events_with_dates[i], 'universe_year', 0)
                year2 = getattr(events_with_dates[i + 1], 'universe_year', 0)
                gap = year2 - year1
                if gap > 100:  # Пропуск более 100 лет
                    issues.append({
                        "type": "large_time_gap",
                        "severity": "low",
                        "entity_type": "timeline",
                        "description": f"Большой пропуск во времени между событиями '{events_with_dates[i].title}' ({year1}) и '{events_with_dates[i + 1].title}' ({year2}): {gap} лет"
                    })
        
        return {
            "total_issues": len(issues),
            "issues": issues,
            "by_severity": {
                "high": len([i for i in issues if i["severity"] == "high"]),
                "medium": len([i for i in issues if i["severity"] == "medium"]),
                "low": len([i for i in issues if i["severity"] == "low"]),
            }
        }
    except Exception as e:
        import traceback
        raise Exception(f"Ошибка при проверке временной консистентности: {str(e)}\n{traceback.format_exc()}")

async def suggest_links(db: AsyncSession, universe_id: int) -> List[Dict]:
    """Автоматические предложения связей на основе анализа"""
    from app.services import timeline as timeline_service
    from app.services import knowledge
    
    suggestions = []
    
    try:
        characters = await knowledge.get_characters(db, universe_id)
        locations = await knowledge.get_locations(db, universe_id)
        events = await timeline_service.get_timeline_events(db, universe_id)
        existing_links = await get_links(db, universe_id)
        
        # Создаём множество существующих связей для быстрой проверки
        existing_link_set = set()
        for link in existing_links:
            key1 = (link.source_type, link.source_id, link.target_type, link.target_id)
            key2 = (link.target_type, link.target_id, link.source_type, link.source_id)
            existing_link_set.add(key1)
            existing_link_set.add(key2)
        
        # Предложения на основе событий: персонажи, участвующие вместе
        char_together = {}  # (char1_id, char2_id) -> count
        for event in events:
            event_char_ids = [c.id for c in (event.characters if hasattr(event, 'characters') and event.characters else [])]
            for i, char1_id in enumerate(event_char_ids):
                for char2_id in event_char_ids[i+1:]:
                    pair = tuple(sorted([char1_id, char2_id]))
                    char_together[pair] = char_together.get(pair, 0) + 1
        
        # Предложения связей между персонажами
        for (char1_id, char2_id), count in char_together.items():
            if count >= 2:  # Участвовали вместе в 2+ событиях
                key = ('character', char1_id, 'character', char2_id)
                if key not in existing_link_set:
                    char1 = next((c for c in characters if c.id == char1_id), None)
                    char2 = next((c for c in characters if c.id == char2_id), None)
                    if char1 and char2:
                        suggestions.append({
                            "source_type": "character",
                            "source_id": char1_id,
                            "source_name": char1.name,
                            "target_type": "character",
                            "target_id": char2_id,
                            "target_name": char2.name,
                            "link_type": "related",
                            "reason": f"Участвовали вместе в {count} событиях",
                            "confidence": min(count * 0.3, 1.0)  # Чем больше событий, тем выше уверенность
                        })
        
        # Предложения на основе локаций: персонажи в одной локации
        char_in_location = {}  # (char_id, loc_id) -> count
        for event in events:
            event_loc_id = getattr(event, 'location_id', None)
            if event_loc_id:
                event_char_ids = [c.id for c in (event.characters if hasattr(event, 'characters') and event.characters else [])]
                for char_id in event_char_ids:
                    key = (char_id, event_loc_id)
                    char_in_location[key] = char_in_location.get(key, 0) + 1
        
        # Предложения связей персонаж-локация
        for (char_id, loc_id), count in char_in_location.items():
            if count >= 2:  # Персонаж в локации в 2+ событиях
                key1 = ('character', char_id, 'location', loc_id)
                key2 = ('location', loc_id, 'character', char_id)
                if key1 not in existing_link_set and key2 not in existing_link_set:
                    char = next((c for c in characters if c.id == char_id), None)
                    loc = next((l for l in locations if l.id == loc_id), None)
                    if char and loc:
                        suggestions.append({
                            "source_type": "character",
                            "source_id": char_id,
                            "source_name": char.name,
                            "target_type": "location",
                            "target_id": loc_id,
                            "target_name": loc.name,
                            "link_type": "located_in",
                            "reason": f"Персонаж участвовал в {count} событиях в этой локации",
                            "confidence": min(count * 0.3, 1.0)
                        })
        
        # Предложения на основе упоминаний в текстах
        for char in characters:
            char_text = f"{char.description or ''} {char.backstory or ''} {char.traits or ''}".lower()
            # Ищем упоминания других персонажей
            for other_char in characters:
                if other_char.id == char.id:
                    continue
                if other_char.name.lower() in char_text:
                    key = ('character', char.id, 'character', other_char.id)
                    if key not in existing_link_set:
                        suggestions.append({
                            "source_type": "character",
                            "source_id": char.id,
                            "source_name": char.name,
                            "target_type": "character",
                            "target_id": other_char.id,
                            "target_name": other_char.name,
                            "link_type": "related",
                            "reason": f"Упоминание в описании персонажа {char.name}",
                            "confidence": 0.5
                        })
            # Ищем упоминания локаций
            for loc in locations:
                if loc.name.lower() in char_text:
                    key = ('character', char.id, 'location', loc.id)
                    if key not in existing_link_set:
                        suggestions.append({
                            "source_type": "character",
                            "source_id": char.id,
                            "source_name": char.name,
                            "target_type": "location",
                            "target_id": loc.id,
                            "target_name": loc.name,
                            "link_type": "located_in",
                            "reason": f"Упоминание локации в описании персонажа {char.name}",
                            "confidence": 0.5
                        })
        
        # Сортируем по уверенности
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        
        return suggestions[:20]  # Возвращаем топ-20 предложений
        
    except Exception as e:
        import traceback
        raise Exception(f"Ошибка при генерации предложений связей: {str(e)}\n{traceback.format_exc()}")

async def get_universe_development_suggestions(
    db: AsyncSession, 
    universe_id: int,
    connectivity_data: Dict,
    master_db: AsyncSession
) -> Dict:
    """AI-предложения по развитию вселенной на основе анализа"""
    from app.services import knowledge
    from app.services.context_manager import context_manager
    from app.config import settings
    from app.services.llm import llm_service
    from app.schemas import ChatMessage
    
    try:
        book = await knowledge.get_universe(universe_id, master_db)
        if not book:
            raise Exception("Вселенная не найдена")
        
        context = await context_manager.build_context(db, universe_id, master_db=master_db)
        
        # Формируем сводку для AI
        isolated_chars = connectivity_data.get("isolated", {}).get("characters", [])
        isolated_locs = connectivity_data.get("isolated", {}).get("locations", [])
        weakly_connected = connectivity_data.get("weakly_connected", {})
        stats = connectivity_data.get("statistics", {})
        
        prompt = f"""Ты — опытный литературный консультант. Проанализируй вселенную и дай конкретные предложения по её развитию.

КОНТЕКСТ ВСЕЛЕННОЙ:
{context[:1500]}

СТАТИСТИКА:
- Персонажей: {stats.get('total_characters', 0)}
- Локаций: {stats.get('total_locations', 0)}
- Событий: {stats.get('total_events', 0)}
- Средняя связанность персонажей: {stats.get('avg_character_connections', 0)}
- Средняя связанность локаций: {stats.get('avg_location_connections', 0)}

ПРОБЛЕМЫ:
- Изолированных персонажей: {len(isolated_chars)}
- Изолированных локаций: {len(isolated_locs)}
- Слабо связанных персонажей: {len(weakly_connected.get('characters', []))}
- Слабо связанных локаций: {len(weakly_connected.get('locations', []))}

ЗАДАНИЕ: Дай конкретные, практичные предложения по улучшению вселенной. Сфокусируйся на:
1. Как связать изолированные сущности
2. Какие события создать для улучшения связанности
3. Каких персонажей развить
4. Какие локации использовать активнее

ФОРМАТ JSON:
{{
  "suggestions": [
    {{
      "type": "connection|event|character_development|location_usage",
      "priority": "high|medium|low",
      "title": "Краткий заголовок",
      "description": "Подробное описание предложения",
      "action": "Конкретное действие для реализации"
    }}
  ],
  "summary": "Краткое резюме основных проблем и направлений развития"
}}

Будь конкретен и практичен. Максимум 8-10 предложений."""
        
        response = await llm_service.chat(
            messages=[ChatMessage(role="user", content=prompt)],
            provider=settings.default_llm_provider,
            model=settings.get_default_model(settings.default_llm_provider)
        )
        
        # Парсим JSON ответ
        import json
        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
        else:
            return {
                "suggestions": [],
                "summary": "Не удалось получить предложения от AI"
            }
            
    except Exception as e:
        import traceback
        return {
            "suggestions": [],
            "summary": f"Ошибка при генерации предложений: {str(e)}"
        }
