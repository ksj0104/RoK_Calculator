import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clampTipPosition, type AnchorRect } from './levelInfo';

/** 카드 요소에 {...bind(<LevelInfoCard …/>)}를 얹고, 컴포넌트 루트에 {portal}을 렌더링한다.
 *  포털 + fixed 좌표라 스크롤 컨테이너에 잘리지 않는다. 스크롤하면 닫힌다. */
export function useInfoTip() {
  const [tip, setTip] = useState<{ anchor: AnchorRect; content: ReactNode } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!tip || !cardRef.current) {
      setPos(null);
      return;
    }
    const { width, height } = cardRef.current.getBoundingClientRect();
    setPos(clampTipPosition(tip.anchor, { width, height },
      { width: window.innerWidth, height: window.innerHeight }));
  }, [tip]);

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [tip]);

  const bind = (content: ReactNode) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      setTip({ anchor: e.currentTarget.getBoundingClientRect(), content }),
    onMouseLeave: () => setTip(null),
  });

  const portal = tip ? createPortal(
    <div ref={cardRef} className="info-card" role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: 0, top: 0, visibility: 'hidden' }}>
      {tip.content}
    </div>,
    document.body,
  ) : null;

  return { bind, portal };
}
