import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { clampTipPosition, type AnchorRect } from './levelInfo';

/** 호버 카드 틀. 내용은 렌더 시점에 contents에서 다시 꺼내므로, 호버한 채로 레벨을 바꿔도
 *  최신 정보가 보인다(부모 JSX의 bind 호출이 모두 끝난 뒤 이 컴포넌트가 렌더되기 때문). */
export function InfoTipFrame({ anchor, contents, tipKey }: {
  anchor: AnchorRect;
  contents: RefObject<Map<string, ReactNode>>;
  tipKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const content = contents.current?.get(tipKey) ?? null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 호버 중 레벨이 바뀌면 카드 크기도 변하므로 ResizeObserver로 위치를 다시 잡는다
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = clampTipPosition(anchor, { width, height },
        { width: window.innerWidth, height: window.innerHeight });
      setPos((previous) =>
        (previous && previous.x === next.x && previous.y === next.y ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor]);

  return createPortal(
    <div ref={ref} className="info-card" role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: 0, top: 0, visibility: 'hidden' }}>
      {content}
    </div>,
    document.body,
  );
}
