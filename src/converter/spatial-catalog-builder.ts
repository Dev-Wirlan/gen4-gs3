import type { AdaptiveCurveGeometry, FieldNode } from "./types";

export interface SpatialCatalogCurve {
  guid: string;
  name: string;
  geometry: AdaptiveCurveGeometry;
}

const xmlEscape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function curveMbr(geometry: AdaptiveCurveGeometry) {
  const points = geometry.lines.flatMap((line) => line.points);
  return {
    north: Math.max(...points.map((p) => p.latitude)),
    south: Math.min(...points.map((p) => p.latitude)),
    east: Math.max(...points.map((p) => p.longitude)),
    west: Math.min(...points.map((p) => p.longitude)),
  };
}

const makeUuid = () => crypto.randomUUID();

export function buildSpatialCatalog(
  field: Pick<FieldNode, "id" | "name">,
  curves: SpatialCatalogCurve[],
  clientId: string,
  clientName: string,
  farmId: string,
  farmName: string,
): string {
  const node = makeUuid();
  const now = new Date().toISOString();
  const items = curves.map(({ guid, name, geometry }) => {
    const mbr = curveMbr(geometry);
    return `    <CurvedTrackLine lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(guid)}}" spatialGeometryType="point" fileName="CurveTrack${xmlEscape(guid)}" name="${xmlEscape(name)}">
      <spatial:MBR uomSource="arcdeg" uomTarget="arcdeg" north="${mbr.north}" south="${mbr.south}" east="${mbr.east}" west="${mbr.west}" />
      <rcdscbase:vrEastShiftComponent value="0" sourceUOM="mm" variableRepresentation="vrEastShiftComponent" />
      <rcdscbase:vrNorthShiftComponent value="0" sourceUOM="mm" variableRepresentation="vrNorthShiftComponent" />
      <rcdscbase:vrReferenceLatitude value="${geometry.referenceLatitude}" sourceUOM="arcdeg" variableRepresentation="vrLatitude" />
      <rcdscbase:vrReferenceLongitude value="${geometry.referenceLongitude}" sourceUOM="arcdeg" variableRepresentation="vrLongitude" />
    </CurvedTrackLine>`;
  }).join("\\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rcdscfldie:SpatialCatalog xmlns:rcdsetup="urn:schemas-johndeere-com:RCD:Setup" xmlns:bt="urn:schemas-johndeere-com:BasicTypes" xmlns:rcdscbase="urn:schemas-johndeere-com:RCD:SpatialCatalog:Base" xmlns:unit="urn:schemas-johndeere-com:UnitSystem" xmlns:rep="urn:schemas-johndeere-com:Representation" xmlns:spatial="urn:schemas-johndeere-com:SpatialTypes" xmlns:rcdscfldie="urn:schemas-johndeere-com:RCD:SpatialCatalog:FieldImportExport">
  <FileSchemaVersion nonProductionCode="0">
    <bt:FileSchemaContentVersion major="1" minor="11" />
    <bt:UnitOfMeasureVersion major="1" minor="43" />
    <bt:RepresentationSystemVersion major="4" minor="161" />
  </FileSchemaVersion>
  <SourceApp major="2" minor="0" build="0" revision="135" nameSourceApp="RCD Target Provider" uuidSourceApp="{b050528e-f328-4dd8-9e9c-71fe8153692e}" uuidSourceAppNode="{${node}}" uuidSession="{${makeUuid()}}" />
  <Setup>
    <rcdsetup:FileSchemaVersion nonProductionCode="0"><bt:FileSchemaContentVersion major="3" minor="28" /><bt:UnitOfMeasureVersion major="1" minor="43" /><bt:RepresentationSystemVersion major="4" minor="161" /></rcdsetup:FileSchemaVersion>
    <bt:Synchronization><bt:NodeVersions><bt:Node uuid="{${node}}" lastSeen="${now}" /></bt:NodeVersions><bt:EntityDeletions /></bt:Synchronization>
    <rcdsetup:Participant><rcdsetup:Client lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(clientId)}}" name="${xmlEscape(clientName)}" /></rcdsetup:Participant>
    <rcdsetup:Farm lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(farmId)}}" name="${xmlEscape(farmName)}" clientRef="{${xmlEscape(clientId)}}" /></rcdsetup:Farm>
    <rcdsetup:Field lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(field.id)}}" name="${xmlEscape(field.name)}" farmRef="{${xmlEscape(farmId)}}" /></rcdsetup:Field>
    <rcdsetup:Products />
  </Setup>
  <SpatialItems eridFieldRef="{${xmlEscape(field.id)}}">
${items}
  </SpatialItems>
</rcdscfldie:SpatialCatalog>`;
}
