import { useMemo } from 'react';
import { catalog, iconUrl } from '../catalog';
import { computePlan } from '../engine/plan';
import type { Goal, Resource, UserState } from '../engine/types';
import { useLang } from '../i18n';
import { formatDuration, formatNumber } from './format';

const RESOURCES: Resource[] = ['food', 'wood', 'stone', 'gold'];

export function ResultTab({ state, goals }: { state: UserState; goals: Goal[] }) {
  const { t, name } = useLang();
  const plan = useMemo(
    () => (goals.length > 0 ? computePlan(catalog, state, goals) : null),
    [state, goals]);

  if (!plan) return <section><p>{t('result.noGoals')}</p></section>;
  if (plan.tasks.length === 0) return <section><p>{t('result.done')}</p></section>;

  const queueName = (q: number) => {
    const builders = state.secondBuilder ? 2 : 1;
    if (q >= builders) return t('result.queue.research');
    return t(q === 0 ? 'result.queue.builder1' : 'result.queue.builder2');
  };

  const usedSummary: Record<string, number> = {};
  for (const perTask of Object.values(plan.speedupsUsed)) {
    for (const [type, units] of Object.entries(perTask)) {
      for (const [unit, count] of Object.entries(units as Record<string, number>)) {
        const key = `${t(`speedup.${type}`)} ${unit}`;
        usedSummary[key] = (usedSummary[key] ?? 0) + count;
      }
    }
  }

  return (
    <div>
      <section>
        <h2>{t('result.totalTime')}</h2>
        <div className="stat-cards">
          <div className="stat-card">
            <div>{t('result.beforeSpeedups')}</div>
            <div className="value">{formatDuration(plan.totalSecRaw, t)}</div>
          </div>
          <div className="stat-card">
            <div>{t('result.afterSpeedups')}</div>
            <div className="value">{formatDuration(plan.totalSecWithSpeedups, t)}</div>
          </div>
          <div className="stat-card">
            <div>{t('result.totalPower')}</div>
            <div className="value">+{formatNumber(plan.totalPower)}</div>
          </div>
        </div>
      </section>
      <section>
        <h2>{t('result.totalCost')}</h2>
        <div className="stat-cards">
          {RESOURCES.map((r) => (
            <div className="stat-card" key={r}>
              <div>{t(`res.${r}`)}</div>
              <div className="value">{formatNumber(plan.totalCost[r])}</div>
            </div>
          ))}
        </div>
      </section>
      {Object.keys(usedSummary).length > 0 && (
        <section>
          <h2>{t('result.speedupsUsed')}</h2>
          <ul>{Object.entries(usedSummary).map(([k, v]) => <li key={k}>{k} × {v}</li>)}</ul>
        </section>
      )}
      <section>
        <h2>{t('result.timeline')}</h2>
        <table className="timeline">
          <thead>
            <tr><th>#</th><th /><th>{t('result.start')}</th><th>{t('result.duration')}</th><th /></tr>
          </thead>
          <tbody>
            {plan.tasks.map((task, i) => (
              <tr key={task.key}>
                <td>{i + 1}</td>
                <td>
                  <img src={iconUrl(task.kind, task.node.id)} alt="" />
                  {name(task.node.id)} {t('level')}{task.node.level}
                </td>
                <td>{formatDuration(task.startSec, t)}</td>
                <td>{formatDuration(task.durationSec, t)}</td>
                <td>{queueName(task.queue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
