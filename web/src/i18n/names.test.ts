import { describe, expect, it } from 'vitest';
import namesEn from '../data/names.en.json';
import namesKo from '../data/names.ko.json';

describe('Korean catalog names', () => {
  it('covers every English building and research name', () => {
    expect(Object.keys(namesKo).sort()).toEqual(Object.keys(namesEn).sort());
  });

  it('uses Korean labels instead of English fallbacks', () => {
    for (const label of Object.values(namesKo)) {
      expect(label).toMatch(/[가-힣]/);
    }
  });

  it('keeps representative in-game terminology', () => {
    expect(namesKo).toMatchObject({
      watchtower: '경계탑',
      academy: '아카데미',
      lyceum_of_wisdom: '지식 광장',
      improved_fletching: '궁깃 개선',
      wootz_steel: '인도제 강철',
      trebuchet: '평형추 투석기',
    });
  });
});
