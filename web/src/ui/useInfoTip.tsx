import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnchorRect } from './levelInfo';
import { InfoTipFrame } from './InfoTipFrame';

/** 카드 요소에 {...bind(키, <LevelInfoCard …/>)}를 얹고, 컴포넌트 루트에 {portal}을 렌더링한다.
 *  내용은 키로 보관해 렌더마다 갱신되므로 호버 중 레벨을 바꿔도 카드가 따라 바뀐다.
 *  포털 + fixed 좌표라 스크롤 컨테이너에 잘리지 않는다. 스크롤하면 닫힌다. */
export function useInfoTip() {
  const [tip, setTip] = useState<{ key: string; anchor: AnchorRect } | null>(null);
  const contents = useRef(new Map<string, ReactNode>());

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [tip]);

  const bind = (key: string, content: ReactNode) => {
    contents.current.set(key, content);
    return {
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
        setTip({ key, anchor: event.currentTarget.getBoundingClientRect() }),
      onMouseLeave: () => setTip(null),
    };
  };

  const portal = tip
    ? <InfoTipFrame anchor={tip.anchor} contents={contents} tipKey={tip.key} />
    : null;

  return { bind, portal };
}
