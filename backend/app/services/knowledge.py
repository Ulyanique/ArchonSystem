from app.repositories.universe import (
    _touch_universe, _to_universe_id, get_universes, get_universe, create_universe, update_universe, delete_universe
)
from app.repositories.character import (
    get_characters, get_character, character_alive_at_universe_time, character_age_at_universe_time,
    create_character, update_character, delete_character
)
from app.repositories.location import (
    get_locations, get_location, create_location, update_location, delete_location
)
from app.repositories.chapter import (
    get_chapters, get_chapter, create_chapter, update_chapter, delete_chapter
)
from app.repositories.scene_beat import (
    get_beats, get_beat, create_beat, update_beat, delete_beat, reorder_beats, move_beat_to_chapter
)
from app.repositories.note import (
    get_notes, get_note, create_note, update_note, delete_note,
    get_outline_items, get_outline_item, create_outline_item, update_outline_item, delete_outline_item,
    move_outline_item,
)
from app.repositories.wiki import (
    get_wiki_articles, get_wiki_article, get_wiki_article_by_slug, create_wiki_article, update_wiki_article, delete_wiki_article
)
from app.repositories.character_knowledge import (
    get_character_knowledge_list, get_character_knowledge_by_id, create_character_knowledge,
    update_character_knowledge, delete_character_knowledge
)
from app.repositories.chapter_mention import (
    add_mention as add_chapter_mention,
    remove_mention as remove_chapter_mention,
    get_mentions_for_chapter,
    get_coverage_stats,
)
from app.repositories.chapter_mention import ENTITY_TYPES as CHAPTER_MENTION_ENTITY_TYPES

# Алиасы для совместимости
get_books = get_universes
get_book = get_universe
create_book = create_universe
update_book = update_universe
delete_book = delete_universe
