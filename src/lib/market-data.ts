import type { MarketPoint, CurrencyPair } from './types';

export function generateNextMockPoint(lastPoint: MarketPoint, volatility: number): MarketPoint {
  const changePercent = (Math.random() - 0.495) * (volatility / lastPoint.close);
  const change = lastPoint.close * changePercent;
  let newClose = lastPoint.close + change;

  if (newClose <= 0) {
      newClose = lastPoint.close * 0.1;
  }

  const open = lastPoint.close;
  const high = Math.max(open, newClose) * (1 + (Math.random() * volatility / lastPoint.close / 10));
  const low = Math.min(open, newClose) * (1 - (Math.random() * volatility / lastPoint.close / 10));

  return {
    timestamp: Date.now(),
    open,
    high,
    low,
    close: newClose,
    volume: lastPoint.volume * (0.95 + Math.random() * 0.1),
  };
}

export function getInitialHistory(pair: CurrencyPair): MarketPoint[] {
    const data: MarketPoint[] = [];
    let lastPrice = pair.basePrice;
    let lastVolume = Math.random() * 10000;
    const now = Date.now();

    for (let i = 0; i < 100; i++) {
        const changePercent = (Math.random() - 0.5) * (pair.volatility / lastPrice);
        const change = lastPrice * changePercent;
        const close = lastPrice + change;
        const open = lastPrice;
        const high = Math.max(open, close) * 1.002;
        const low = Math.min(open, close) * 0.998;
        const volume = lastVolume * (0.9 + Math.random() * 0.2);

        data.push({
            timestamp: now - (100 - i) * 60000,
            open,
            high,
            low,
            close,
            volume,
        });

        lastPrice = close;
        lastVolume = volume;
    }
    return data;
}
