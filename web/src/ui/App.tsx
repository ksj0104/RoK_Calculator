import { useState } from 'react';
// import type { Goal } from '../engine/types';
import { LangProvider, useLang } from '../i18n';
import { useUserState } from '../state/userState';
import { CityTab } from './CityTab';
// TODO(Task 13): re-enable once GoalsTab exists
// import { GoalsTab } from './GoalsTab';
// TODO(Task 14): re-enable once ResultTab exists
// import { ResultTab } from './ResultTab';

function Shell() {
  const { t, lang, setLang } = useLang();
  const [state, dispatch] = useUserState();
  // const [goals, setGoals] = useState<Goal[]>([]);
  const [tab, setTab] = useState<'city' | 'goals' | 'result'>('city');

  return (
    <div className="app">
      <header>
        <h1>RoK Calculator</h1>
        <nav>
          {(['city', 'goals', 'result'] as const).map((id) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {t(`tab.${id}`)}
            </button>
          ))}
        </nav>
        <button className="lang" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
      </header>
      <main>
        {tab === 'city' && <CityTab state={state} dispatch={dispatch} />}
        {/* TODO(Task 13): re-enable once GoalsTab exists */}
        {/* {tab === 'goals' && <GoalsTab goals={goals} setGoals={setGoals} />} */}
        {/* TODO(Task 14): re-enable once ResultTab exists */}
        {/* {tab === 'result' && <ResultTab state={state} goals={goals} />} */}
      </main>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
