export type LotMapRing = ReadonlyArray<Readonly<[number, number]>>;

export type LotMapFeatureProperties = Readonly<{
  lotNumber: string;
  stageKey: string;
  stageName: string;
  stageOrder: number;
  status?: string | null;
  lotId?: string | null;
  area?: number | null;
  price?: number | null;
  ventorName?: string | null;
  holdUntil?: string | null;
  soldBy?: string | null;
}>;

export type LotMapGeoJsonFeature = Readonly<{
  type: 'Feature';
  properties: LotMapFeatureProperties;
  geometry: Readonly<{
    type: 'Polygon';
    coordinates: ReadonlyArray<LotMapRing>;
  }>;
}>;

export type LotMapGeoJson = Readonly<{
  type: 'FeatureCollection';
  features: ReadonlyArray<LotMapGeoJsonFeature>;
}>;

export type LotMapPaintResult = Readonly<{
  projectId: string;
  projectTitle: string;
  lotsMapKml: string;
  lotsMapGeojson: string;
  geojson: LotMapGeoJson;
  featureCount: number;
  matchedCount: number;
}>;

export type LotMapUploadResult = Readonly<{
  projectId: string;
  lotsMapKml: string;
  lotsMapGeojson: string;
  featureCount: number;
  createdLots: number;
  stages: ReadonlyArray<{
    stageKey: string;
    stageName: string;
    count: number;
  }>;
  swapStages: boolean;
}>;
