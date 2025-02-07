export interface AffordabilityMetric {
  month: string;
  homeownerAffordability: number;
  renterAffordability: number;
  affordabilityGap: number;
  totalPayment: number;
  mortgagePayment: number;
  paymentGap: number;
  affordablePrice: number;
  medianPrice: number;
  priceGap: number;
  gapTrend?: number;
  priceTrend?: number;
}

export interface Region {
  name: string;
  type: 'metro' | 'state' | 'county' | 'zip';
} 