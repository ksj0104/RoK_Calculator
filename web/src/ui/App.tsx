import { useEffect, useRef, useState } from 'react';
import { catalog } from '../catalog';
import type { Goal, PlanMode } from '../engine/types';
import { LangProvider } from '../i18n';
import { useLang } from '../i18n/useLang';
import { downloadBackup, parseImport } from '../state/persistence';
import { useUserState } from '../state/userState';
import { CityTab } from './CityTab';
import { GoalsTab } from './GoalsTab';
import { ResultTab } from './ResultTab';
import { TroopTrainingCalculator } from './TroopTrainingCalculator';
import { PurchaseValueGuide } from './PurchaseValueGuide';

const GOALS_STORAGE_KEY = 'rok-calculator-goals-v1';

function validGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const goal = candidate as Partial<Goal>;
    const entry = catalog.find((item) => item.kind === goal.type && item.id === goal.id);
    if (!entry || typeof goal.level !== 'number' || !Number.isFinite(goal.level)) return [];
    return [{ type: entry.kind, id: entry.id,
      level: Math.max(1, Math.min(entry.maxLevel, Math.floor(goal.level))) }];
  });
}

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (raw) return validGoals(JSON.parse(raw));
  } catch { /* 손상된 저장값은 무시 */ }
  return [];
}

function Shell() {
  const { t, lang, setLang } = useLang();
  const [state, dispatch] = useUserState();
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [mode, setMode] = useState<PlanMode>(() =>
    localStorage.getItem('rok-calculator-mode-v1') === 'efficient' ? 'efficient' : 'fastest');
  const [workspace, setWorkspace] = useState<'growth' | 'training' | 'purchases'>('growth');
  const [cityOpen, setCityOpen] = useState(() => window.innerWidth > 820);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('rok-calculator-mode-v1', mode);
  }, [mode]);

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
      setGoals(validGoals(parsed.goals));
      setStatus({ kind: 'ok', text: t('app.importOk') });
    } catch {
      setStatus({ kind: 'error', text: t('app.importError') });
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="icon-button city-toggle"
          aria-expanded={cityOpen}
          aria-controls="city-drawer"
          onClick={() => setCityOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
          <span>{t('app.cityPanel')}</span>
        </button>
        <div className="brand">
          <h1>RoK Route Lab</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="compact-button" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>
            {lang === 'ko' ? 'EN' : '한국어'}
          </button>
          <button className="compact-button" onClick={handleExport}>{t('app.export')}</button>
          <button className="compact-button" onClick={handleImportClick}>{t('app.import')}</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {status && <span className={`status ${status.kind}`} role="status">{status.text}</span>}
      </header>
      <button
        className={`drawer-backdrop ${cityOpen ? 'visible' : ''}`}
        aria-label={t('app.closeCity')}
        onClick={() => setCityOpen(false)}
      />
      <aside id="city-drawer" className={`city-drawer ${cityOpen ? 'open' : ''}`}>
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">PROFILE</span>
            <h2>{t('tab.city')}</h2>
          </div>
          <button className="icon-button close-button" aria-label={t('app.closeCity')}
            onClick={() => setCityOpen(false)}>×</button>
        </div>
        <CityTab state={state} dispatch={dispatch} />
      </aside>
      {!cityOpen && (
        <button className="drawer-handle" onClick={() => setCityOpen(true)}>
          <span aria-hidden="true">›</span>{t('app.openCity')}
        </button>
      )}
      <main className={`main-content ${cityOpen ? 'drawer-open' : ''}`}>
        <nav className="workspace-switch" aria-label={t('app.calculators')}>
          <button className={workspace === 'growth' ? 'active' : ''} onClick={() => setWorkspace('growth')}>
            {t('app.growthCalculator')}
          </button>
          <button className={workspace === 'training' ? 'active' : ''} onClick={() => setWorkspace('training')}>
            {t('app.trainingCalculator')}
          </button>
          <button className={workspace === 'purchases' ? 'active' : ''} onClick={() => setWorkspace('purchases')}>
            {t('app.purchaseGuide')}
          </button>
        </nav>
        {workspace === 'growth' ? <>
          <GoalsTab goals={goals} setGoals={setGoals} mode={mode} setMode={setMode} />
          <ResultTab state={state} goals={goals} mode={mode} />
        </> : workspace === 'training'
          ? <TroopTrainingCalculator state={state} dispatch={dispatch} />
          : <PurchaseValueGuide />}
      </main>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
