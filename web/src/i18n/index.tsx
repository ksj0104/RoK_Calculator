import { useEffect, useState, type ReactNode } from 'react';
import namesEn from '../data/names.en.json';
import namesKo from '../data/names.ko.json';
import { LangContext, type Lang } from './context';
import en from './ui.en';
import ko from './ui.ko';

const dicts: Record<Lang, Record<string, string>> = { ko, en };
const names: Record<Lang, Record<string, string>> = {
  ko: namesKo as Record<string, string>, en: namesEn as Record<string, string>,
};

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>(() =>
    localStorage.getItem('rok-lang') === 'en' ? 'en' : 'ko');
  const setLang = (l: Lang) => { localStorage.setItem('rok-lang', l); setLangRaw(l); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dicts[lang][key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const name = (id: string) => names[lang][id] ?? names.en[id] ?? id;
  return <LangContext.Provider value={{ lang, setLang, t, name }}>{children}</LangContext.Provider>;
}
