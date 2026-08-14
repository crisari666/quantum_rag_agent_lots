export type LotStatusSummary = Readonly<{
  available: number;
  sold: number;
  hold: number;
  locked: number;
  total: number;
}>;

export type LotKindSummary = Readonly<{
  lot: LotStatusSummary;
  commercial: LotStatusSummary;
}>;

export type PublicProjectLot = Readonly<{
  number: string;
  area: number;
  price: number;
  status: string;
  kind: string;
}>;

export type ProjectLotInventoryRow = Readonly<{
  projectId: string;
  title: string;
  enabled: boolean;
  nLots: number;
  nCommercialSpaces: number;
  baseLotArea: number;
  baseCommercialArea: number;
  summary: LotKindSummary;
}>;
