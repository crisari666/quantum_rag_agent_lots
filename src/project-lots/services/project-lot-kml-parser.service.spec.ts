import { ProjectLotKmlParserService } from './project-lot-kml-parser.service';

describe('ProjectLotKmlParserService', () => {
  const parser = new ProjectLotKmlParserService();

  const buildKml = (placemarks: string): string => `
    <?xml version="1.0" encoding="utf-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Folder>
          <name>Lotes (poligonos)</name>
          ${placemarks}
        </Folder>
      </Document>
    </kml>
  `;

  const square = (
    lon: number,
    lat: number,
  ): string =>
    `${lon},${lat},0 ${lon + 0.001},${lat},0 ${lon + 0.001},${lat + 0.001},0 ${lon},${lat + 0.001},0 ${lon},${lat},0`;

  it('reads stage and lot from ExtendedData (1-N / 2-N)', () => {
    const kml = buildKml(`
      <Placemark>
        <name>1-12</name>
        <ExtendedData>
          <SchemaData schemaUrl="#LotSchema">
            <SimpleData name="lotNumber">12</SimpleData>
            <SimpleData name="stageKey">1</SimpleData>
          </SchemaData>
        </ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-74.76, 4.12)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
      <Placemark>
        <name>2-3</name>
        <ExtendedData>
          <SchemaData schemaUrl="#LotSchema">
            <SimpleData name="lotNumber">3</SimpleData>
            <SimpleData name="stageKey">2</SimpleData>
          </SchemaData>
        </ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-74.75, 4.12)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    `);
    const geojson = parser.parseLotsPolygons(kml);
    expect(geojson.features).toHaveLength(2);
    expect(geojson.features[0].properties).toMatchObject({
      stageKey: '1',
      lotNumber: '12',
      stageName: 'Etapa 1',
    });
    expect(geojson.features[1].properties).toMatchObject({
      stageKey: '2',
      lotNumber: '3',
      stageName: 'Etapa 2',
    });
  });

  it('parses stage-lot from placemark name when ExtendedData is missing', () => {
    const kml = buildKml(`
      <Placemark>
        <name>2-45</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-74.7, 4.1)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    `);
    const geojson = parser.parseLotsPolygons(kml);
    expect(geojson.features[0].properties).toMatchObject({
      stageKey: '2',
      lotNumber: '45',
    });
  });

  it('swaps explicit stage keys 1 and 2 when swapStages is true', () => {
    const kml = buildKml(`
      <Placemark>
        <name>1-1</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-74.7, 4.1)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    `);
    const geojson = parser.parseLotsPolygons(kml, true);
    expect(geojson.features[0].properties.stageKey).toBe('2');
  });

  it('falls back to west/east for legacy plain lot numbers', () => {
    const kml = buildKml(`
      <Placemark>
        <name>10</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-75, 4)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
      <Placemark>
        <name>20</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-74, 4)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    `);
    const geojson = parser.parseLotsPolygons(kml);
    const byLot = Object.fromEntries(
      geojson.features.map((f) => [f.properties.lotNumber, f.properties.stageKey]),
    );
    expect(byLot['10']).toBe('1');
    expect(byLot['20']).toBe('2');
  });
});
