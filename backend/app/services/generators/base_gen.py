import json
import re
from typing import List, Dict

class BaseGenerator:
    def _parse_json_array(self, response: str) -> List[Dict]:
        """Парсинг JSON массива из ответа"""
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        return []

    def _parse_json_object(self, response: str) -> Dict:
        """Парсинг JSON объекта из ответа"""
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        return {}
