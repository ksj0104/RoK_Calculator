from rok_wiki.textutil import is_placeholder, parse_amount, parse_duration, slugify

def test_parse_amount_plain():
    assert parse_amount("1,847") == 1847

def test_parse_amount_k_m_suffix():
    assert parse_amount("3.5K") == 3500
    assert parse_amount("184.3K") == 184300
    assert parse_amount("1.2M") == 1200000

def test_parse_amount_none_and_empty():
    assert parse_amount("None") == 0
    assert parse_amount("") == 0

def test_parse_amount_space_thousands():
    assert parse_amount("1 351") == 1351

def test_parse_amount_dotted_thousands():
    assert parse_amount("5.250.000") == 5250000

def test_parse_amount_placeholder():
    assert parse_amount("?") == 0
    assert parse_amount("???") == 0

def test_parse_duration_units():
    assert parse_duration("2s") == 2
    assert parse_duration("5m") == 300
    assert parse_duration("1h 30m") == 5400
    assert parse_duration("22h") == 79200
    assert parse_duration("3d 12h") == 302400
    assert parse_duration("None") == 0

def test_parse_duration_placeholder():
    assert parse_duration("?") == 0

def test_parse_duration_bare_number_is_seconds():
    assert parse_duration("5") == 5
    assert parse_duration("0") == 0

def test_is_placeholder_per_resource_cost_cell():
    # cost 셀은 자원 4개가 각각 "?"로 렌더링되면 get_text(" ")로 합쳐 "? ? ? ?"가 된다
    # (Pavise/Heavy Frame Lv10). 공백을 무시하고도 물음표만 남으면 placeholder로 인식해야 한다.
    assert is_placeholder("? ? ? ?")
    assert not is_placeholder("0 0 0 0")
    assert not is_placeholder("")


def test_slugify():
    assert slugify("City Hall") == "city_hall"
    assert slugify("Cutting & Polishing") == "cutting_and_polishing"
    assert slugify("Builder's Hut") == "builders_hut"
    assert slugify("Chu-Ko-Nu") == "chu_ko_nu"
