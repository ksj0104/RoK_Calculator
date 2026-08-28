import re

_SUFFIX = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
_UNIT_SEC = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_amount(s: str) -> int:
    s = (s or "").strip().replace(",", "")
    if not s or s.lower() == "none":
        return 0
    m = re.fullmatch(r"([\d.]+)\s*([KMB])?", s)
    if not m:
        raise ValueError(f"cannot parse amount: {s!r}")
    value = float(m.group(1)) * _SUFFIX.get(m.group(2) or "", 1)
    return round(value)


def parse_duration(s: str) -> int:
    s = (s or "").strip()
    if not s or s.lower() == "none":
        return 0
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
