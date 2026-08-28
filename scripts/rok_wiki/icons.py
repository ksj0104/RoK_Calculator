"""위키 이미지 파일에서 건물/연구 아이콘을 내려받는다.

파일명 규칙(조사 결과): 건물 = "Building_<Name>_1_5.png" 또는 "_6_4" 등 변형이 있어
prefix 검색 후 첫 매치를 쓴다. 연구 = "Technology_<Name>.png" (정확 일치 우선).
"""
import time
from pathlib import Path

import requests

from .api import HEADERS, fetch_image_urls


def _download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    time.sleep(0.5)


def _pick(candidates: dict[str, str], exact: str | None = None) -> str | None:
    if exact and exact in candidates:
        return candidates[exact]
    return next(iter(sorted(candidates.items())), (None, None))[1]


def download_all_icons(building_ids: list[str], research_ids: list[str],
                       names_en: dict[str, str], out_dir: Path) -> list[str]:
    warnings = []
    (out_dir / "buildings").mkdir(parents=True, exist_ok=True)
    (out_dir / "research").mkdir(parents=True, exist_ok=True)

    for bid in building_ids:
        wiki_name = names_en[bid].replace(" ", "_")
        url = _pick(fetch_image_urls(f"Building_{wiki_name}"))
        if url is None:
            warnings.append(f"icon missing: building {bid}")
            continue
        _download(url, out_dir / "buildings" / f"{bid}.png")

    for rid in research_ids:
        wiki_name = names_en[rid].replace(" ", "_")
        url = _pick(fetch_image_urls(f"Technology_{wiki_name}"), exact=f"Technology_{wiki_name}.png")
        if url is None:
            warnings.append(f"icon missing: research {rid}")
            continue
        _download(url, out_dir / "research" / f"{rid}.png")
    return warnings
