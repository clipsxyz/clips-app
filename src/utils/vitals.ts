import { onCLS, onFID, onLCP } from 'web-vitals';

export function initVitals(log = (n: string, v: number) => console.log(n, v)) {
  onCLS(d => log('CLS', d.value));
  onFID(d => log('FID', d.value));
  onLCP(d => log('LCP', d.value));
}
