/** Shared bargain types. Pure data so the simulation can run off-headset. */

export type StrategyId = 'stock-pressure' | 'floor-hawk' | 'walkaway-temper';

export interface MerchantState {
  id: string;
  name: string;
  strategy: StrategyId;
  epithet: string;
  /** One sentence a player can read without a manual. */
  tells: string;
  robe: string;
  accent: string;
  /** Hidden reservation, as a fraction of the artifact's whispered worth. */
  baseFloorRatio: number;
  /** 0 = fresh stock, 1 = the goods have sat all night. */
  stockPressure: number;
  /** 1 = patient, 0 = gone. */
  temper: number;
  insultCount: number;
  /** Opening ask as a fraction of whispered worth. */
  askRatio: number;
  /** Quill raises her hidden floor after she storms off. */
  memoryMarkup: number;
}

export interface Artifact {
  id: string;
  name: string;
  fairValue: number;
  buyerValue: number;
  blurb: string;
  form: 'teapot' | 'silk' | 'astrolabe' | 'cage' | 'pearl';
}

export interface FairnessScore {
  /** Jain index on the two surplus utilities, rounded to 4 decimals. */
  jain: number;
  buyerShare: number;
  sellerShare: number;
  buyerUtility: number;
  sellerUtility: number;
  buyerSurplus: number;
  sellerSurplus: number;
  exploitativeLowball: boolean;
  /** Lightning veto. True only when the seller is the starved side. */
  veto: boolean;
  verdict: string;
}

export interface ObservedDeal {
  /** First number the player put on the table, divided by the opening ask. */
  openingRatio: number;
  offerRatios: number[];
  rounds: number;
  walkedAway: boolean;
  merchantLeft: boolean;
  vetoed: boolean;
  sealed: boolean;
  jain: number;
  lowestRatio: number;
}

export interface SpiritStyle {
  dealsSeen: number;
  /** Fraction of the ask the spirit opens at. Lower is more aggressive. */
  openingRatio: number;
  /** How fast the spirit closes a gap, as a fraction per round. */
  concessionPerRound: number;
  patienceRounds: number;
  /** Chance-like bias toward leaving. 0 stays, 1 walks. */
  walkawayBias: number;
  /** Jain score the spirit tries to land on or above. */
  targetJain: number;
  lowestRatio: number;
}

export interface TradeRecord {
  who: 'player' | 'spirit';
  merchantId: string;
  merchantName: string;
  strategy: StrategyId;
  artifactName: string;
  price: number;
  jain: number;
  vetoed: boolean;
  sealed: boolean;
  walked: boolean;
  /** Buyer surplus in coins. Zero unless the deal sealed. */
  surplus: number;
  line: string;
}

export interface MarketReport {
  minutes: number;
  trades: TradeRecord[];
  sealed: number;
  vetoed: number;
  walked: number;
  profit: number;
  loss: number;
  net: number;
  meanJain: number;
  rumors: string[];
}

export type Phase = 'haggling' | 'ready' | 'review' | 'report';

export type GestureId = 'pinch' | 'open-palm' | 'handshake' | 'walk-away' | 'none';
