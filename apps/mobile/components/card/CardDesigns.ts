export type CardDesignKey = 'dark' | 'blue' | 'purple' | 'light' | 'premium' | 'onyx' | 'crimson' | 'gold' | 'midnight';

export type CardDesign = {
  key: CardDesignKey;
  label: string;
  colors: [string, string, ...string[]];
  textColor: string;
  mutedColor: string;
  accentColor: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export const CARD_DESIGNS: CardDesign[] = [
  {
    key: 'onyx',
    label: 'Onyx Stealth',
    colors: ['#2a2a2a', '#131313'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.4)',
    accentColor: '#FF3B3B',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'crimson',
    label: 'Royal Crimson',
    colors: ['#8B201F', '#410003'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.4)',
    accentColor: '#FFD700',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'gold',
    label: 'Gold Reserve',
    colors: ['#C5A059', '#704214'],
    textColor: '#2a2a2a',
    mutedColor: 'rgba(42,42,42,0.5)',
    accentColor: '#2a2a2a',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'midnight',
    label: 'Midnight Sapphire',
    colors: ['#1e3a8a', '#0f172a'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.5)',
    accentColor: '#38bdf8',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'dark',
    label: 'Dark Minimal',
    colors: ['#2a2a2a', '#131313'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.4)',
    accentColor: '#FF3B3B',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'blue',
    label: 'Blue Gradient',
    colors: ['#1a6cf6', '#0a3d9e'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.5)',
    accentColor: '#7EB8FF',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'purple',
    label: 'Purple Gradient',
    colors: ['#7c3aed', '#4c1d95'],
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.5)',
    accentColor: '#C4B5FD',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  {
    key: 'light',
    label: 'Light Clean',
    colors: ['#f8fafc', '#e2e8f0'],
    textColor: '#1e293b',
    mutedColor: 'rgba(30,41,59,0.45)',
    accentColor: '#3b82f6',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
];

export const getDesign = (key: string): CardDesign =>
  CARD_DESIGNS.find(d => d.key === key) ?? CARD_DESIGNS[0];
