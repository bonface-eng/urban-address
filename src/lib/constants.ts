import type { CurrencyPair } from './types';
import { BitcoinIcon, DollarSignIcon, EuroIcon, JapaneseYenIcon } from 'lucide-react';
import { EthIcon, AppleIcon } from '@/components/icons';

export const CURRENCY_PAIRS: CurrencyPair[] = [
  {
    id: 'BTC-USD',
    symbol: 'BTC/USD',
    name: 'Bitcoin / US Dollar',
    category: 'crypto',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    basePrice: 68000,
    volatility: 300,
    icon: BitcoinIcon,
  },
  {
    id: 'ETH-USD',
    symbol: 'ETH/USD',
    name: 'Ethereum / US Dollar',
    category: 'crypto',
    baseAsset: 'ETH',
    quoteAsset: 'USD',
    basePrice: 3500,
    volatility: 30,
    icon: EthIcon,
  },
  {
    id: 'EUR-USD',
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    baseAsset: 'EUR',
    quoteAsset: 'USD',
    basePrice: 1.08,
    volatility: 0.001,
    icon: EuroIcon,
  },
  {
    id: 'USD-JPY',
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    category: 'forex',
    baseAsset: 'USD',
    quoteAsset: 'JPY',
    basePrice: 157,
    volatility: 0.1,
    icon: JapaneseYenIcon,
  },
  {
    id: 'AAPL-USD',
    symbol: 'AAPL/USD',
    name: 'Apple Inc. / US Dollar',
    category: 'stock',
    baseAsset: 'AAPL',
    quoteAsset: 'USD',
    basePrice: 214,
    volatility: 2.5,
    icon: AppleIcon,
  },
];

export const INITIAL_BALANCE = 50000;
export const CHART_INTERVAL_MS = 2000;
