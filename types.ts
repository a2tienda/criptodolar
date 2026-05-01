export interface ExchangeData {
  rate: number;
  binanceRate?: number;
  binanceVariation?: number;
  binanceTrend?: 'up' | 'down' | 'stable';
  goldRate?: number;
  bitcoinRate?: number;
  date: string;
  lastUpdate: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ServiceResponse {
  data: ExchangeData | null;
  sources: GroundingChunk[];
  rawText?: string;
}

