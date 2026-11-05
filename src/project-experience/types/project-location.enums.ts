export enum ProjectLocationCategory {
  hospital = 'hospital',
  education = 'education',
  shopping = 'shopping',
  tourism = 'tourism',
  nature = 'nature',
  transport = 'transport',
  road = 'road',
  town = 'town',
  services = 'services',
  other = 'other',
}

export enum ProjectLocationSource {
  mapbox = 'mapbox',
  osm = 'osm',
  manual = 'manual',
  official = 'official',
}

export enum ProjectLocationImportance {
  low = 'low',
  medium = 'medium',
  high = 'high',
  featured = 'featured',
}

export enum ProjectLocationGeometryType {
  Point = 'Point',
  LineString = 'LineString',
  Polygon = 'Polygon',
}
