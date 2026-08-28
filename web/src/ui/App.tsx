import { useEffect, useRef, useState } from 'react';
import type { Goal } from '../engine/types';
import { LangProvider, useLang } from '../i18n';
import { downloadBackup, parseImport } from '../state/persistence';
import { useUserState } from '../state/userState';
import { CityTab } from './CityTab';
import { GoalsTab } from './GoalsTab';
import { ResultTab } from './ResultTab';

const GOALS_STORAGE_KEY = 'rok-calculator-goals-v1';

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 손상된 저장값은 무시 */ }
  return [];
}

function Shell() {
  const { t, lang, setLang } = useLang();
  const [state, dispatch] = useUserState();
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [tab, setTab] = useState<'city' | 'goals' | 'result'>('city');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  function handleExport() {
    downloadBackup(state, goals);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImport(text);
      dispatch({ type: 'replace', state: parsed.state });
      setGoals(parsed.goals);
      setStatus({ kind: 'ok', text: t('app.importOk') });
    } catch {
      setStatus({ kind: 'error', text: t('app.importError') });
    }
  }

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
        <button onClick={handleExport}>{t('app.export')}</button>
        <button onClick={handleImportClick}>{t('app.import')}</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {status && <span className={`status ${status.kind}`}>{status.text}</span>}
      </header>
      <main>
        {tab === 'city' && <CityTab state={state} dispatch={dispatch} />}
        {tab === 'goals' && <GoalsTab goals={goals} setGoals={setGoals} />}
        {tab === 'result' && <ResultTab state={state} goals={goals} />}
      </main>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
