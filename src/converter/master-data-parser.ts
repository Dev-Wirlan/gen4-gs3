import { detectSpatialType } from "./spatial-data-parser";
import type { ClientNode, FieldNode, MasterSpatialRecord, SpatialType } from "./types";

const elementName = (element: Element) => element.localName.toLowerCase();
const attr = (element: Element, names: string[]) => {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const attribute of Array.from(element.attributes)) {
    if (wanted.has(attribute.localName.toLowerCase()) || wanted.has(attribute.name.toLowerCase())) return attribute.value;
  }
  return undefined;
};

export const normalizeGuid = (value?: string) => value?.trim().replace(/^\{?|\}?$/g, "").toLowerCase() || undefined;

const guid = (element: Element) => normalizeGuid(attr(element, ["StringGuid", "Guid", "ObjectGuid", "Id", "Uid"]));
const taggedEntity = (element: Element) => {
  const childFarm = Array.from(element.children).find(
    (child) => elementName(child) === "farm",
  );

  return (
    normalizeGuid(childFarm?.textContent) ??
    normalizeGuid(
      attr(element, [
        "TaggedEntity",
        "ParentGuid",
        "Parent",
        "FarmGuid",
        "ClientGuid",
        "Client",
        "CustomerGuid",
        "GrowerGuid",
      ]),
    )
  );
};

const identity = (element: Element, fallback: string) => ({
  id: guid(element) ?? fallback,
  name: attr(element, ["name", "designator", "label", "description"]) ?? fallback,
});

const emptyField = (element: Element, fallback: string): FieldNode => ({
  ...identity(element, fallback), spatial: [], adaptiveCurves: [], abLines: [], boundaries: [], flags: [],
});

const isEntity = (element: Element, terms: string[]) => terms.some((term) => elementName(element).includes(term));

const spatialType = (element: Element): SpatialType => {
  const signature = [element.localName, ...Array.from(element.attributes).flatMap((item) => [item.localName, item.value])].join(" ");
  return detectSpatialType(signature);
};

export interface MasterDataResult { clients: ClientNode[]; spatial: MasterSpatialRecord[] }

export function parseMasterData(xmlText: string): MasterDataResult {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("MasterData.xml contém XML inválido.");
  const all = Array.from(document.querySelectorAll("*"));
  const clientElements = all.filter((node) => isEntity(node, ["client", "customer", "grower"]) && guid(node));
  const farmElements = all.filter((node) => isEntity(node, ["farm", "fazenda"]) && guid(node));
  const fieldElements = all.filter((node) => isEntity(node, ["field", "parcel", "talhao", "talhão"]) && spatialType(node) === "Unknown" && guid(node));
  const clientNodes = clientElements.map((node, index) => ({ ...identity(node, `Cliente ${index + 1}`), farms: [] as ClientNode["farms"] }));
  const farmNodes = farmElements.map((node, index) => ({ ...identity(node, `Fazenda ${index + 1}`), parentId: taggedEntity(node), fields: [] as FieldNode[] }));
  const fields = fieldElements.map((node, index) => ({ ...emptyField(node, `Talhão ${index + 1}`), parentId: taggedEntity(node) }));

  for (const field of fields) {
    const farm = farmNodes.find((entry) => entry.id === field.parentId);
    if (farm) farm.fields.push(field);
  }
  for (const farm of farmNodes) {
    const client = clientNodes.find((entry) => entry.id === farm.parentId);
    if (client) client.farms.push({ id: farm.id, name: farm.name, fields: farm.fields });
  }

  const unattachedFarms = farmNodes.filter((farm) => !clientNodes.some((client) => client.id === farm.parentId));
  if (!clientNodes.length && farmNodes.length) clientNodes.push({ id: "project", name: "Projeto Gen4", farms: [] });
  for (const farm of unattachedFarms) clientNodes[0]?.farms.push({ id: farm.id, name: farm.name, fields: farm.fields });
  const attachedFieldIds = new Set(clientNodes.flatMap((client) => client.farms.flatMap((farm) => farm.fields.map((field) => field.id))));
  const unattachedFields = fields.filter((field) => !attachedFieldIds.has(field.id));
  if (unattachedFields.length) {
    if (!clientNodes.length) clientNodes.push({ id: "project", name: "Projeto Gen4", farms: [] });
    clientNodes[0]?.farms.push({ id: "unlinked-farm", name: "Fazenda sem vínculo confirmado", fields: unattachedFields });
  }

  const spatial = all.flatMap((node): MasterSpatialRecord[] => {
    const type = spatialType(node);
    const objectGuid = guid(node);
    if (type === "Unknown" || !objectGuid) return [];
    const path = Array.from(node.attributes).map((item) => item.value).find((value) => value.toLowerCase().includes(".gjson"));
    const fieldId = taggedEntity(node);
    return [{ guid: objectGuid, name: attr(node, ["Name", "Designator", "Label", "Description"]) ?? objectGuid, ...(fieldId ? { fieldId } : {}), ...(path ? { path } : {}), type }];
  });
  const uniqueSpatial = [...new Map(spatial.map((item) => [item.guid, item])).values()];
  return { clients: clientNodes.filter((client) => client.farms.some((farm) => farm.fields.length)), spatial: uniqueSpatial };
}