export type ProjectLocationRoute = {
  profile: 'driving';
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
};
