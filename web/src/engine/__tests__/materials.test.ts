import { describe, expect, it } from 'vitest';
import { MATERIAL_GEMS, materialGems, materialsForLevel, sumMaterials } from '../materials';

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
