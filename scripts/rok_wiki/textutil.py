import re

_SUFFIX = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
_UNIT_SEC = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def is_placeholder(s: str) -> bool:
    """위키가 아직 값을 채우지 않은 자리인지 확인한다. "?", "???"뿐 아니라 자원별로 개별
    "?"가 공백으로 나열된 cost 셀("? ? ? ?", food/wood/stone/gold 각각 미기재)도 잡아야 한다."""
    compact = (s or "").strip().replace(" ", "")
    return bool(compact) and set(compact) <= {"?"}


def parse_amount(s: str) -> int:
    s = (s or "").strip().replace(",", "").replace(" ", "")
    if not s or s.lower() == "none" or is_placeholder(s):
        return 0
    m = re.fullmatch(r"([\d.]+)\s*([KMB])?", s)
    if not m:
        raise ValueError(f"cannot parse amount: {s!r}")
    number, suffix = m.group(1), m.group(2)
    if number.count(".") > 1:  # 위키 오기: "5.250.000"처럼 마침표를 천단위 구분자로 쓴 경우
        number = number.replace(".", "")
    value = float(number) * _SUFFIX.get(suffix or "", 1)
    return round(value)


def parse_duration(s: str) -> int:
    s = (s or "").strip()
    if not s or s.lower() == "none" or is_placeholder(s):
        return 0
    if re.fullmatch(r"\d+", s):  # 단위 없이 초 단위 숫자만 적힌 경우 (예: "0", "5")
        return int(s)
    total = 0
    for num, unit in re.findall(r"(\d+)\s*([smhd])", s):
        total += int(num) * _UNIT_SEC[unit]
    if total == 0 and not re.search(r"[smhd]", s):
        raise ValueError(f"cannot parse duration: {s!r}")
    return total


def slugify(name: str) -> str:
    s = name.strip().lower().replace("&", "and").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")
