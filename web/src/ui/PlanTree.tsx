import { catalog, iconUrl } from '../catalog';
import type { Plan } from '../engine/plan';
import type { NodeId } from '../engine/types';
import { useLang } from '../i18n/useLang';
import { formatDuration } from './format';
import { LevelInfoCard } from './InfoHover';
import { useInfoTip } from './useInfoTip';

const entryByKey = new Map(catalog.map((entry) => [`${entry.kind}:${entry.id}`, entry]));

export function PlanTree({ plan }: { plan: Plan }) {
  const { t, name } = useLang();
  const { bind, portal } = useInfoTip();
  const taskByKey = new Map(plan.tasks.map((task) => [task.key, task]));
  const stageMemo = new Map<NodeId, number>();
  const stageOf = (key: NodeId): number => {
    const cached = stageMemo.get(key);
    if (cached !== undefined) return cached;
    const task = taskByKey.get(key);
    const deps = task?.node.deps.filter((dep) => taskByKey.has(dep)) ?? [];
    const stage = deps.length === 0 ? 0 : Math.max(...deps.map(stageOf)) + 1;
    stageMemo.set(key, stage);
    return stage;
  };
  const stages = new Map<number, typeof plan.tasks>();
  for (const task of plan.tasks) {
    const stage = stageOf(task.key);
    const group = stages.get(stage) ?? [];
    group.push(task);
    stages.set(stage, group);
  }
  const boostIds = new Set(plan.selectedBoosts.map((boost) => boost.id));

  return (
    <div className="tree-scroll" tabIndex={0} aria-label={t('result.techTree')}>
      <div className="plan-tree">
        {[...stages.entries()].sort(([a], [b]) => a - b).map(([stage, tasks], index, all) => (
          <div className="tree-stage" key={stage}>
            <div className="tree-stage-label">{t('result.stage', { n: stage + 1 })}</div>
            <div className="tree-stage-items">
              {tasks.sort((a, b) => a.startSec - b.startSec).map((task) => {
                const entry = entryByKey.get(`${task.kind}:${task.node.id}`);
                const row = entry?.levels.find((level) => level.level === task.node.level);
                return (
                <article className={`tree-node ${task.kind} ${boostIds.has(task.node.id) ? 'boost' : ''}`}
                  key={task.key}
                  {...(entry && row
                    ? bind(<LevelInfoCard entry={entry} row={row} durationSec={task.durationSec} />)
                    : {})}>
                  <img src={iconUrl(task.kind, task.node.id)} alt="" />
                  <div>
                    <strong>{name(task.node.id)}</strong>
                    <span>{t('level')}{task.node.level} · {formatDuration(task.durationSec, t)}</span>
                    {task.node.deps.length > 0 && (
                      <small>{t('result.requires', { n: task.node.deps.length })}</small>
                    )}
                  </div>
                  {boostIds.has(task.node.id) && <b title={t('result.routeBoost')}>+</b>}
                </article>
                );
              })}
            </div>
            {index < all.length - 1 && <div className="stage-arrow" aria-hidden="true">→</div>}
          </div>
        ))}
      </div>
      {portal}
    </div>
  );
}
