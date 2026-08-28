import hashlib
import json
import time
from pathlib import Path

import requests

API = "https://riseofkingdoms.fandom.com/api.php"
CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"
HEADERS = {"User-Agent": "RoK-Calculator-Scraper/1.0 (personal fan project)"}
_DELAY_SEC = 0.5
_last_request = 0.0


def _get(params: dict) -> dict:
    global _last_request
    CACHE_DIR.mkdir(exist_ok=True)
    key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    wait = _DELAY_SEC - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    resp = requests.get(API, params={**params, "format": "json", "formatversion": "2"},
                        headers=HEADERS, timeout=30)
    _last_request = time.monotonic()
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"wiki API error for {params}: {data['error']['info']}")
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def fetch_parse(page: str) -> dict:
    """action=parse 결과의 parse 딕셔너리 (wikitext 포함)."""
    return _get({"action": "parse", "page": page, "prop": "wikitext"})["parse"]


def fetch_html(page: str) -> str:
    """렌더링된 페이지 HTML."""
    return _get({"action": "parse", "page": page, "prop": "text"})["parse"]["text"]


def fetch_image_urls(prefix: str) -> dict[str, str]:
    """파일명 prefix로 이미지 검색, {파일명: URL} 반환."""
    data = _get({"action": "query", "list": "allimages", "aiprefix": prefix, "ailimit": "50"})
    return {img["name"]: img["url"] for img in data["query"]["allimages"]}
