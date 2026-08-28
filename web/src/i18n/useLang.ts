import { useContext } from 'react';
import { LangContext } from './context';

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error('useLang outside LangProvider');
  return context;
}
