import { describe, expect, it } from 'vitest';
import purchaseData from '../purchases.json';

describe('purchase catalog', () => {
  it('keeps ranks contiguous after sorting by value', () => {
    expect(purchaseData.products.map((product) => product.rank))
      .toEqual(Array.from({ length: purchaseData.products.length }, (_, index) => index + 1));
  });

  it('uses verified Korean game terms instead of community shorthand', () => {
    const koreanCopy = purchaseData.products
      .flatMap((product) => [product.nameKo, product.valueKo, product.noteKo])
      .join(' ');

    expect(koreanCopy).not.toMatch(/도시회관|금머리|금열쇠|루체른 두루마리/);
    expect(koreanCopy).toContain('시청');
    expect(koreanCopy).toContain('전설 사령관 조각상');
    expect(koreanCopy).toContain('루체른 스크롤');
    expect(koreanCopy).toContain('여권 페이지');
  });

  it('documents the requested progression and battle-loss pop-ups', () => {
    const products = new Map(purchaseData.products.map((product) => [product.id, product]));

    expect(products.get('one_step_ahead')?.valueKo).toContain('시청 Lv.19·23·25');
    expect(products.get('research_powerhouse')?.valueKo).toContain('아카데미 Lv.20·22·24·25');
    expect(products.get('fate_changer')?.valueKo).toContain('전투력이 크게 감소');
  });
});
