import { useState } from 'react';
import { buildings, catalog, iconUrl, research } from '../catalog';
import type { Goal, NodeKind } from '../engine/types';
import { useLang } from '../i18n';

const CH_PRESETS = [8, 11, 16, 17, 21, 22, 25];

export function GoalsTab({ goals, setGoals }: { goals: Goal[]; setGoals: (g: Goal[]) => void }) {
  const { t, name } = useLang();
  const [kind, setKind] = useState<NodeKind>('building');
  const [id, setId] = useState('city_hall');
  const entries = kind === 'building' ? buildings : research;
  const entry = catalog.find((e) => e.kind === kind && e.id === id) ?? entries[0];
  const [level, setLevel] = useState(1);

  const addGoal = (g: Goal) => {
    const rest = goals.filter((x) => !(x.type === g.type && x.id === g.id));
    setGoals([...rest, g]);
  };

  return (
    <div>
      <section>
        <h2>{t('goals.presets')}</h2>
        <div className="presets">
          {CH_PRESETS.map((n) => (
            <button key={n} onClick={() => addGoal({ type: 'building', id: 'city_hall', level: n })}>
              {t('goals.cityHallTo', { n })}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>{t('goals.custom')}</h2>
        <div className="goal-row">
          <select value={kind} onChange={(e) => { setKind(e.target.value as NodeKind); setId(''); }}>
            <option value="building">{t('city.buildings')}</option>
            <option value="research">{t('city.research')}</option>
          </select>
          <select value={entry.id} onChange={(e) => setId(e.target.value)}>
            {entries.map((b) => <option key={b.id} value={b.id}>{name(b.id)}</option>)}
          </select>
          <select value={Math.min(level, entry.maxLevel)} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: entry.maxLevel }, (_, i) => (
              <option key={i + 1} value={i + 1}>{t('level')}{i + 1}</option>
            ))}
          </select>
          <button onClick={() => addGoal({ type: kind, id: entry.id, level: Math.min(level, entry.maxLevel) })}>
            {t('goals.add')}
          </button>
        </div>
      </section>
      <section>
        <h2>{t('tab.goals')}</h2>
        {goals.length === 0 && <p>{t('goals.empty')}</p>}
        {goals.map((g) => (
          <div className="goal-row" key={`${g.type}:${g.id}`}>
            <img src={iconUrl(g.type, g.id)} alt="" width={28} height={28} />
            <span>{name(g.id)} {t('level')}{g.level}</span>
            <button onClick={() => setGoals(goals.filter((x) => x !== g))}>{t('goals.remove')}</button>
          </div>
        ))}
      </section>
    </div>
  );
}
