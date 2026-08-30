import { useMemo, useState } from 'react';
import purchaseData from '../data/purchases.json';
import { useLang } from '../i18n/useLang';

const goals = ['all', 'general', 'commander', 'equipment', 'speedup', 'research',
  'building', 'training', 'war', 'kvk', 'migration', 'resources'] as const;

export function PurchaseValueGuide() {
  const { t, lang } = useLang();
  const [goal, setGoal] = useState<(typeof goals)[number]>('all');
  const products = useMemo(() => purchaseData.products
    .filter((product) => goal === 'all' || product.goals.includes(goal)), [goal]);

  return (
    <div className="purchase-workspace">
      <section className="purchase-hero">
        <span className="eyebrow">SPENDING VALUE</span>
        <h2>{t('purchase.title')}</h2>
        <p>{t('purchase.description')}</p>
        <div className="purchase-notice">{t('purchase.notice', {
          date: purchaseData.verifiedAt, currency: purchaseData.currency,
        })}</div>
      </section>

      <section className="purchase-panel">
        <div className="purchase-method">
          <div><strong>{t('purchase.methodTitle')}</strong><p>{t('purchase.method')}</p></div>
          <div className="purchase-tier-legend">
            {['S', 'A', 'B', 'C', 'D', t('purchase.conditional')].map((tier) => (
              <span key={tier} className={`tier-${tier === t('purchase.conditional') ? 'conditional' : tier.toLowerCase()}`}>
                {tier}
              </span>
            ))}
          </div>
        </div>
        <div className="purchase-filters" aria-label={t('purchase.goalFilter')}>
          {goals.map((item) => (
            <button key={item} className={goal === item ? 'active' : ''}
              onClick={() => setGoal(item)}>{t(`purchase.goal.${item}`)}</button>
          ))}
        </div>

        <div className="purchase-list">
          {products.map((product) => (
            <article key={product.id} className="purchase-card">
              <div className="purchase-rank"><span>#{product.rank}</span>
                <b className={`tier-${product.tier === '조건부' ? 'conditional' : product.tier.toLowerCase()}`}>
                  {product.tier === '조건부' ? t('purchase.conditional') : product.tier}
                </b>
              </div>
              <div className="purchase-body">
                <div className="purchase-title-row">
                  <div><h3>{lang === 'ko' ? product.nameKo : product.nameEn}</h3>
                    <span>{t(`purchase.category.${product.category}`)}</span></div>
                  <strong>{product.priceUsd}</strong>
                </div>
                <p>{lang === 'ko' ? product.valueKo : product.valueEn}</p>
                <small>{lang === 'ko' ? product.noteKo : product.noteEn}</small>
              </div>
              <div className="purchase-meta">
                <span>{t(`purchase.availability.${product.availability}`)}</span>
                <span className={`confidence-${product.confidence}`}>
                  {t('purchase.confidence', { value: t(`purchase.confidence.${product.confidence}`) })}
                </span>
              </div>
            </article>
          ))}
        </div>

        <details className="purchase-sources">
          <summary>{t('purchase.sources')}</summary>
          <p>{t('purchase.sourcesNote')}</p>
          <ul>{purchaseData.sources.map((source) => (
            <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>
          ))}</ul>
        </details>
      </section>
    </div>
  );
}
