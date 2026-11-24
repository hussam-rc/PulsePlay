import { lazy, Suspense } from 'react';

// The QR generator is only needed on the lobby screen, so it loads on demand.
const Real = lazy(() => import('./QR'));
const box = 'bg-white rounded-2xl p-3 shadow-soft w-48 sm:w-60 aspect-square';
export function QR(props: { text: string; label: string }) {
  return <Suspense fallback={<div className={box} role="img" aria-label={props.label} />}><Real {...props} /></Suspense>;
}
