from rok_wiki.textutil import parse_amount, parse_duration, slugify

def test_parse_amount_plain():
    assert parse_amount("1,847") == 1847

def test_parse_amount_k_m_suffix():
    assert parse_amount("3.5K") == 3500
    assert parse_amount("184.3K") == 184300
    assert parse_amount("1.2M") == 1200000

def test_parse_amount_none_and_empty():
    assert parse_amount("None") == 0
    assert parse_amount("") == 0

def test_parse_duration_units():
    assert parse_duration("2s") == 2
    assert parse_duration("5m") == 300
    assert parse_duration("1h 30m") == 5400
    assert parse_duration("22h") == 79200
    assert parse_duration("3d 12h") == 302400
    assert parse_duration("None") == 0

def test_slugify():
    assert slugify("City Hall") == "city_hall"
    assert slugify("Cutting & Polishing") == "cutting_and_polishing"
    assert slugify("Builder's Hut") == "builders_hut"
    assert slugify("Chu-Ko-Nu") == "chu_ko_nu"
