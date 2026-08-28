import { createContext } from 'react';

export type Lang = 'ko' | 'en';

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  name: (id: string) => string;
}

export const LangContext = createContext<LangContextValue | null>(null);
