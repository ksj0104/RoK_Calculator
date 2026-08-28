import { useMemo } from 'react';
import { catalog, iconUrl } from '../catalog';
import { computePlan } from '../engine/plan';
import type { Goal, PlanMode, Resource, UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import { formatDuration, formatNumber } from './format';
import { PlanTree } from './PlanTree';

const RESOURCES: Resource[] = ['food', 'wood', 'stone', 'gold'];

export function ResultTab({ state, goals, mode }: { state: UserState; goals: Goal[]; mode: PlanMode }) {
  const { t, name } = useLang();
  const plan = useMemo(
    () => (goals.length > 0 ? computePlan(catalog, state, goals, mode) : null),
    [state, goals, mode]);

  if (!plan) {
    return (
      <section className="result-panel result-empty">
        <span className="step-number">03</span>
        <div className="empty-orbit" aria-hidden="true"><span>⌁</span></div>
        <h2>{t('result.waiting')}</h2>
        <p>{t('result.noGoals')}</p>
      </section>
    );
  }
  if (plan.tasks.length === 0) {
    return <section className="result-panel result-empty"><h2>{t('result.done')}</h2></section>;
  }

  const queueName = (queue: number) => {
    const builders = state.secondBuilder ? 2 : 1;
    if (queue >= builders) return t('result.queue.research');
    return t(queue === 0 ? 'result.queue.builder1' : 'result.queue.builder2');
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
    <section className="result-panel">
      <div className="section-heading result-heading">
        <div>
          <span className="step-number">03</span>
          <div><h2>{t('result.title')}</h2><p>{t(`result.${mode}Route`)}</p></div>
        </div>
        <span className={`mode-badge ${mode}`}>{t(`mode.${mode}`)}</span>
      </div>

      {plan.selectedBoosts.length > 0 && (
        <div className="optimization-callout">
          <span className="callout-icon">⌁</span>
          <div><strong>{t('result.optimized')}</strong><p>{t('result.optimizedDesc')}</p></div>
          <div className="boost-list">
            {plan.selectedBoosts.map((boost) => (
              <span key={boost.id}>
                <img src={iconUrl('research', boost.id)} alt="" />
                {name(boost.id)} {t('level')}{boost.level} · +{boost.bonusPct}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="result-stats">
        <article className="primary-stat">
          <span>{t('result.afterSpeedups')}</span>
          <strong>{formatDuration(plan.totalSecWithSpeedups, t)}</strong>
          <small>{t('result.beforeSpeedups')}: {formatDuration(plan.totalSecRaw, t)}</small>
        </article>
        {(['building', 'research'] as const).map((kind) => (
          <article key={kind} className="kind-stat">
            <span>{t(kind === 'building' ? 'result.buildingTime' : 'result.researchTime')}</span>
            <strong>{formatDuration(plan.kindTimes[kind].finishSec, t)}</strong>
            <small>{t('result.workSum')}: {formatDuration(plan.kindTimes[kind].workSec, t)}</small>
          </article>
        ))}
        <article><span>{t('result.tasks')}</span><strong>{formatNumber(plan.tasks.length)}</strong></article>
        <article><span>{t('result.totalPower')}</span><strong>+{formatNumber(plan.totalPower)}</strong></article>
        {RESOURCES.map((resource) => (
          <article key={resource}><span>{t(`res.${resource}`)}</span>
            <strong>{formatNumber(plan.totalCost[resource])}</strong></article>
        ))}
      </div>

      {Object.keys(usedSummary).length > 0 && (
        <div className="speedup-summary">
          <strong>{t('result.speedupsUsed')}</strong>
          {Object.entries(usedSummary).map(([key, value]) => <span key={key}>{key} × {value}</span>)}
        </div>
      )}

      <div className="tree-heading">
        <div><h3>{t('result.techTree')}</h3><p>{t('result.techTreeDesc')}</p></div>
        <span>{t('result.scrollHint')}</span>
      </div>
      <PlanTree plan={plan} />

      <details className="timeline-details">
        <summary>{t('result.timeline')} · {plan.tasks.length}</summary>
        <div className="timeline-scroll">
          <table className="timeline">
            <thead><tr><th>#</th><th>{t('result.task')}</th><th>{t('result.start')}</th>
              <th>{t('result.duration')}</th><th>{t('result.queue')}</th></tr></thead>
            <tbody>
              {plan.tasks.map((task, index) => (
                <tr key={task.key}>
                  <td>{index + 1}</td>
                  <td><img src={iconUrl(task.kind, task.node.id)} alt="" />
                    {name(task.node.id)} {t('level')}{task.node.level}</td>
                  <td>{formatDuration(task.startSec, t)}</td>
                  <td>{formatDuration(task.durationSec, t)}</td>
                  <td>{queueName(task.queue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
