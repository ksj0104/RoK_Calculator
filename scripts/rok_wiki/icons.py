"""위키 이미지 파일에서 건물/연구 아이콘을 내려받는다.

파일명 규칙(조사 결과): 건물 = "Building_<Name>_1_5.png" 또는 "_6_4" 등 변형이 있어
prefix 검색 후 첫 매치를 쓴다. 연구 = "Technology_<Name>.png" (정확 일치 우선).

주의: 위키의 이미지 CDN(Thumblr)은 URL이 ".png"로 끝나도 실제로는 WebP 바이트를 돌려준다.
Accept: image/png을 명시해도(직접 확인 결과) 협상되지 않고, "/revision/latest" 없이 원본
경로를 직접 요청해도 마찬가지로 WebP가 나온다 — 원본 자체가 WebP로만 서빙되는 것으로
보인다. 그래서 헤더로 요청하는 대신 받은 바이트를 Pillow로 디코드해 진짜 PNG로 다시
인코드한 뒤 저장한다. 그렇게 해도 유효한 이미지가 아니면 파일을 남기지 않고 경고한다.
"""
import io
import time
from pathlib import Path

import requests
from PIL import Image

from .api import HEADERS, fetch_image_urls

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_IMAGE_HEADERS = {**HEADERS, "Accept": "image/png,image/*;q=0.8"}


def is_png_file(path: Path) -> bool:
    """파일이 실제로 PNG 매직 넘버로 시작하는지 확인한다 (확장자만 믿지 않는다)."""
    if not path.exists():
        return False
    with path.open("rb") as f:
        return f.read(8) == _PNG_MAGIC


def _fetch_as_png(url: str) -> bytes:
    """CDN이 어떤 포맷으로 응답하든(대개 WebP) Pillow로 디코드해 진짜 PNG 바이트로
    재인코드한다. 이미 PNG면 그대로 반환한다."""
    resp = requests.get(url, headers=_IMAGE_HEADERS, timeout=30)
    resp.raise_for_status()
    raw = resp.content
    if raw[:8] == _PNG_MAGIC:
        return raw
    img = Image.open(io.BytesIO(raw))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _download(url: str, dest: Path) -> str | None:
    """PNG를 dest에 받는다. 이미 유효한 PNG가 있으면(매직 넘버 확인) 건드리지 않는다 —
    확장자만으로는 판단하지 않으므로 과거에 WebP를 .png로 잘못 저장한 파일도 다시 받는다.
    변환/검증에 실패하면 잘못된 파일을 남기지 않고 경고 메시지를 반환한다."""
    if is_png_file(dest):
        return None
    try:
        png_bytes = _fetch_as_png(url)
    except Exception as e:  # noqa: BLE001 - 네트워크 오류/디코딩 실패 등
        if dest.exists():
            dest.unlink()
        return f"could not produce a valid PNG ({e})"
    time.sleep(0.5)
    if png_bytes[:8] != _PNG_MAGIC:
        if dest.exists():
            dest.unlink()
        return "not a real PNG after conversion"
    dest.write_bytes(png_bytes)
    return None


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
        err = _download(url, out_dir / "buildings" / f"{bid}.png")
        if err:
            warnings.append(f"icon invalid: building {bid}: {err}")

    for rid in research_ids:
        wiki_name = names_en[rid].replace(" ", "_")
        url = _pick(fetch_image_urls(f"Technology_{wiki_name}"), exact=f"Technology_{wiki_name}.png")
        if url is None:
            warnings.append(f"icon missing: research {rid}")
            continue
        err = _download(url, out_dir / "research" / f"{rid}.png")
        if err:
            warnings.append(f"icon invalid: research {rid}: {err}")
    return warnings
