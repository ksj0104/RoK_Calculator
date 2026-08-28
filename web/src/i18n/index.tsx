import { createContext, useContext, useState, type ReactNode } from 'react';
import namesEn from '../data/names.en.json';
import namesKo from '../data/names.ko.json';
import en from './ui.en';
import ko from './ui.ko';

type Lang = 'ko' | 'en';
const dicts: Record<Lang, Record<string, string>> = { ko, en };
const names: Record<Lang, Record<string, string>> = {
  ko: namesKo as Record<string, string>, en: namesEn as Record<string, string>,
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  name: (id: string) => string;
}
const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>(() =>
    (localStorage.getItem('rok-lang') as Lang) ?? 'ko');
  const setLang = (l: Lang) => { localStorage.setItem('rok-lang', l); setLangRaw(l); };
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dicts[lang][key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const name = (id: string) => names[lang][id] ?? names.en[id] ?? id;
  return <Ctx.Provider value={{ lang, setLang, t, name }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang outside LangProvider');
  return ctx;
}
