import { describe, expect, it } from 'vitest';
import { MATERIAL_GEMS, materialGems, materialShortfall, materialsForLevel, sumMaterials } from '../materials';

describe('materialsForLevel', () => {
  it('성은 목표 레벨에 해당하는 계약의 서를 쓴다', () => {
    expect(materialsForLevel('building', 'castle', 2)).toEqual({ covenant: 2 });
    expect(materialsForLevel('building', 'castle', 14)).toEqual({ covenant: 150 });
    expect(materialsForLevel('building', 'castle', 24)).toEqual({ covenant: 3000 });
  });

  it('경계탑은 저항의 화살을 같은 수량으로 쓴다', () => {
    expect(materialsForLevel('building', 'watchtower', 5)).toEqual({ arrow: 15 });
    expect(materialsForLevel('building', 'watchtower', 20)).toEqual({ arrow: 1500 });
  });

  it('1레벨은 재화가 들지 않는다', () => {
    expect(materialsForLevel('building', 'castle', 1)).toEqual({});
    expect(materialsForLevel('building', 'watchtower', 1)).toEqual({});
  });

  it('25레벨은 특수 재화와 청사진 1개를 함께 쓴다', () => {
    expect(materialsForLevel('building', 'castle', 25)).toEqual({ covenant: 5000, blueprint: 1 });
    expect(materialsForLevel('building', 'watchtower', 25)).toEqual({ arrow: 5000, blueprint: 1 });
  });

  it('다른 건물은 25레벨에서만 청사진 1개를 쓴다', () => {
    expect(materialsForLevel('building', 'academy', 24)).toEqual({});
    expect(materialsForLevel('building', 'academy', 25)).toEqual({ blueprint: 1 });
    expect(materialsForLevel('building', 'city_hall', 25)).toEqual({ blueprint: 1 });
  });

  it('연구는 특수 재화를 쓰지 않는다', () => {
    expect(materialsForLevel('research', 'masonry', 5)).toEqual({});
    expect(materialsForLevel('research', 'ballista', 25)).toEqual({});
  });
});

describe('sumMaterials / materialGems', () => {
  it('성 1→25 총합은 계약의 서 20,099개와 청사진 1개', () => {
    const total = sumMaterials(Array.from({ length: 25 }, (_, i) =>
      materialsForLevel('building', 'castle', i + 1)));
    expect(total).toEqual({ covenant: 20_099, blueprint: 1 });
  });

  it('20→25 구간은 14,300개', () => {
    const total = sumMaterials([21, 22, 23, 24, 25].map((level) =>
      materialsForLevel('building', 'castle', level)));
    expect(total.covenant).toBe(14_300);
  });

  it('23→25 구간은 8,000개', () => {
    const total = sumMaterials([24, 25].map((level) =>
      materialsForLevel('building', 'castle', level)));
    expect(total.covenant).toBe(8_000);
  });

  it('보석 환산은 개당 단가를 곱해 더한다', () => {
    expect(MATERIAL_GEMS).toEqual({ covenant: 10, arrow: 10, blueprint: 2000 });
    expect(materialGems({ covenant: 100, arrow: 50, blueprint: 2 })).toBe(1000 + 500 + 4000);
    expect(materialGems({})).toBe(0);
  });
});

describe('materialShortfall', () => {
  const required = { covenant: 1000, arrow: 500, blueprint: 3 };

  it('보유량을 빼고 남은 부족분만 센다', () => {
    const r = materialShortfall(required, { covenant: 400, arrow: 500 }, 0);
    expect(r.missing).toEqual({ covenant: 600, blueprint: 3 });
  });

  it('보유가 필요량보다 많아도 음수가 되지 않는다', () => {
    const r = materialShortfall({ covenant: 100 }, { covenant: 999 }, 0);
    expect(r.missing).toEqual({});
    expect(r.gemsForMissing).toBe(0);
    expect(r.gemsShort).toBe(0);
  });

  it('부족분을 보석으로 환산하고 보유 보석을 뺀다', () => {
    // 부족: 계약의 서 600(6000) + 청사진 3(6000) = 12000 보석
    const r = materialShortfall(required, { covenant: 400, arrow: 500 }, 5000);
    expect(r.gemsForMissing).toBe(12_000);
    expect(r.gemsShort).toBe(7_000);
  });

  it('보유 보석이 부족분보다 많으면 부족 보석은 0', () => {
    const r = materialShortfall({ covenant: 10 }, {}, 1_000);
    expect(r.gemsForMissing).toBe(100);
    expect(r.gemsShort).toBe(0);
  });

  it('보유량이 비어 있으면 필요량 전체가 부족분이다', () => {
    const r = materialShortfall(required, {}, 0);
    expect(r.missing).toEqual(required);
    expect(r.gemsForMissing).toBe(materialGems(required));
  });
});
