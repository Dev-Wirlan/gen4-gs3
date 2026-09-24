import type { FieldNode } from "./types";

export interface WaterManagementSpatialCatalogContext {
  field: FieldNode;
  clientId: string;
  clientName: string;
  farmId: string;
  farmName: string;
  node?: string;
}

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const makeUuid = () => crypto.randomUUID();

export function buildWaterManagementSpatialCatalog(
  context: WaterManagementSpatialCatalogContext,
): string {
  const { field, clientId, clientName, farmId, farmName } = context;
  const node = context.node ?? makeUuid();
  const now = new Date().toISOString();

  return `<?xml version="1.0" encoding="utf-8"?>
<rcdscfldiewm:SpatialCatalog xmlns:rcdsetup="urn:schemas-johndeere-com:RCD:Setup" xmlns:bt="urn:schemas-johndeere-com:BasicTypes" xmlns:unit="urn:schemas-johndeere-com:UnitSystem" xmlns:rep="urn:schemas-johndeere-com:Representation" xmlns:spatial="urn:schemas-johndeere-com:SpatialTypes" xmlns:rcdscfldiewm="urn:schemas-johndeere-com:SpatialCatalog:FieldImportExport:WaterManagement">
  <FileSchemaVersion nonProductionCode="0">
    <bt:FileSchemaContentVersion major="1" minor="9" />
    <bt:UnitOfMeasureVersion major="1" minor="43" />
    <bt:RepresentationSystemVersion major="4" minor="161" />
  </FileSchemaVersion>
  <SourceApp major="2" minor="0" build="0" revision="135" nameSourceApp="RCD Target Provider" uuidSourceApp="{b050528e-f328-4dd8-9e9c-71fe8153692e}" uuidSourceAppNode="{${node}}" uuidSession="{${makeUuid()}}" />
  <Setup>
    <rcdsetup:FileSchemaVersion nonProductionCode="0">
      <bt:FileSchemaContentVersion major="3" minor="28" />
      <bt:UnitOfMeasureVersion major="1" minor="43" />
      <bt:RepresentationSystemVersion major="4" minor="161" />
    </rcdsetup:FileSchemaVersion>
    <bt:Synchronization>
      <bt:NodeVersions>
        <bt:Node uuid="{${node}}" lastSeen="${now}" />
      </bt:NodeVersions>
      <bt:EntityDeletions />
    </bt:Synchronization>
    <rcdsetup:Participant>
      <rcdsetup:Client lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(clientId)}}" name="${xmlEscape(clientName)}" />
    </rcdsetup:Participant>
    <rcdsetup:Farm lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(farmId)}}" name="${xmlEscape(farmName)}" clientRef="{${xmlEscape(clientId)}}" />
    <rcdsetup:Field lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(field.id)}}" name="${xmlEscape(field.name)}" farmRef="{${xmlEscape(farmId)}}">
      <Area value="0" sourceUOM="ac" variableRepresentation="vrReportedFieldArea" />
    </rcdsetup:Field>
    <rcdsetup:Products />
  </Setup>
  <SpatialItems eridFieldRef="{${xmlEscape(field.id)}}" />
</rcdscfldiewm:SpatialCatalog>`;
}
