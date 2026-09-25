import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildGen4SetupWorkProject } from "@/converter/gen4-setup-work-builder";
import type { ProjectAnalysis } from "@/converter/types";

const analysis = {} as ProjectAnalysis;

const masterData = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<SetupFile xmlns="urn:schemas-johndeere-com:RCD:Setup">',
  "  <Setup>",
  "    <Participant>",
  '      <Client erid="{client-1}" name="UL" />',
  '      <Farm erid="{farm-1}" name="600057" clientRef="{client-1}" />',
  '      <Field erid="{field-1}" name="600057" farmRef="{farm-1}">',
  "        <Farm>{farm-1}</Farm>",
  "      </Field>",
  '      <WorkDescriptor erid="{work-1}" name="não deve ser copiado" />',
  "    </Participant>",
  "  </Setup>",
  "</SetupFile>",
].join("\n");

describe("buildGen4SetupWorkProject", () => {
  it("preserva Client/Farm/Field e remove WorkDescriptor", async () => {
    const source = new JSZip();
    source.file("MasterData.xml", masterData);
    source.file("Gen4/SpatialFiles/AdaptiveCurve{curve-1}.gjson", '{"type":"FeatureCollection","features":[]}');

    const result = await buildGen4SetupWorkProject(source, analysis);
    const outputXml = await result.zip.file("MasterData.xml")?.async("text");

    expect(outputXml).toContain('erid="{client-1}" name="UL"');
    expect(outputXml).toContain('erid="{farm-1}" name="600057" clientRef="{client-1}"');
    expect(outputXml).toContain('erid="{field-1}" name="600057" farmRef="{farm-1}"');
    expect(outputXml).toContain("<Farm>{farm-1}</Farm>");
    expect(outputXml).not.toContain("WorkDescriptor");
    expect(result.removedWorkDescriptors).toBe(1);
    expect(await result.zip.file("Gen4/SpatialFiles/AdaptiveCurve{curve-1}.gjson")?.async("text")).toBe('{"type":"FeatureCollection","features":[]}');
  });

  it("não inventa entidades do Golden nem altera o objeto de entrada", async () => {
    const source = new JSZip();
    const sourceMasterData = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<SetupFile xmlns="urn:schemas-johndeere-com:RCD:Setup">',
      "  <Setup>",
      "    <Participant>",
      '      <Client erid="{client-1}" name="UL" />',
      '      <Farm erid="{farm-1}" name="600057" clientRef="{client-1}" />',
      '      <Field erid="{field-1}" name="600057" farmRef="{farm-1}">',
      "        <Farm>{farm-1}</Farm>",
      "      </Field>",
      '      <WorkDescriptor erid="{work-1}" name="não deve ser copiado" />',
      "    </Participant>",
      "  </Setup>",
      "</SetupFile>",
    ].join("\n");
    source.file("MasterData.xml", sourceMasterData);

    const result = await buildGen4SetupWorkProject(source, analysis);
    const sourceXml = await source.file("MasterData.xml")?.async("text");
    const outputXml = await result.zip.file("MasterData.xml")?.async("text");

    expect(sourceXml).toContain("<WorkDescriptor ");
    expect(outputXml).not.toContain("WorkDescriptor");
    expect(outputXml).not.toContain("<Operator");
    expect(outputXml).not.toContain("<ABLine");
    expect(outputXml).not.toContain("<ABCurve");
    expect(outputXml).not.toContain("<RTKBaseStations");
  });

  it("falha explicitamente quando MasterData.xml não existe", async () => {
    const source = new JSZip();
    await expect(buildGen4SetupWorkProject(source, analysis)).rejects.toThrow("MasterData.xml não encontrado no projeto Gen4.");
  });
});
