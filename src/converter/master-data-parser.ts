import type { ClientNode, FieldNode } from "./types";

const elementName = (element: Element) => element.localName.toLowerCase();
const attr = (element: Element, names: string[]) => {
  for (const name of names) {
    const value = element.getAttribute(name) ?? element.getAttribute(name.toUpperCase());
    if (value) return value;
  }
  return undefined;
};

const identity = (element: Element, fallback: string) => ({
  id: attr(element, ["id", "uid", "guid", "objectid"]) ?? fallback,
  name: attr(element, ["name", "designator", "label", "description"]) ?? fallback,
});

const directChildren = (element: Element, terms: string[]) =>
  Array.from(element.children).filter((child) => terms.some((term) => elementName(child).includes(term)));

function parseFields(container: Element, prefix: string): FieldNode[] {
  const direct = directChildren(container, ["field", "parcel", "talhao", "talhão"]);
  const candidates = direct.length
    ? direct
    : Array.from(container.querySelectorAll("*")).filter((node) =>
        ["field", "parcel", "talhao", "talhão"].some((term) => elementName(node).includes(term)),
      );
  return candidates.map((node, index) => ({ ...identity(node, `${prefix}-field-${index + 1}`), spatial: [] }));
}

export function parseMasterData(xmlText: string): ClientNode[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("MasterData.xml contém XML inválido.");
  const all = Array.from(document.querySelectorAll("*"));
  const clients = all.filter((node) => ["client", "customer", "grower"].some((term) => elementName(node).includes(term)));

  const clientNodes = (clients.length ? clients : [document.documentElement]).map((client, clientIndex) => {
    const clientInfo = identity(client, clients.length ? `Cliente ${clientIndex + 1}` : "Projeto Gen4");
    const farms = Array.from(client.querySelectorAll("*")).filter((node) =>
      ["farm", "fazenda"].some((term) => elementName(node).includes(term)),
    );
    const farmNodes = (farms.length ? farms : [client]).map((farm, farmIndex) => {
      const farmInfo = identity(farm, farms.length ? `Fazenda ${farmIndex + 1}` : "Estrutura principal");
      return { ...farmInfo, fields: parseFields(farm, farmInfo.id) };
    });
    return { ...clientInfo, farms: farmNodes };
  });

  return clientNodes.filter((client) => client.farms.some((farm) => farm.fields.length > 0));
}

export function findReferencedFieldId(xmlText: string, filePath: string, clients: ClientNode[]) {
  const base = filePath.split("/").pop()?.toLowerCase();
  if (!base) return undefined;
  const index = xmlText.toLowerCase().indexOf(base);
  if (index < 0) return undefined;
  const context = xmlText.slice(Math.max(0, index - 1500), index + 500).toLowerCase();
  return clients
    .flatMap((client) => client.farms.flatMap((farm) => farm.fields))
    .find((field) => context.includes(field.id.toLowerCase()))?.id;
}