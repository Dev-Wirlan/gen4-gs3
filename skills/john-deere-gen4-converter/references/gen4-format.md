# Gen4 Format — conhecimento confirmado

## MasterData.xml

Os projetos Gen4 analisados usam uma estrutura `SetupFile` contendo, entre outros:

- `SourceApp`
- `FileSchemaVersion`
- `Setup`
- entidades de Client/Farm/Field
- entidades espaciais e suas relações.

Os valores exatos de versões de schema variam entre os arquivos analisados e não devem ser tratados como constantes universais.

## Hierarquia Client → Farm → Field

A hierarquia é representada por GUIDs.

No Gen4 real analisado, Farm pode possuir o vínculo com Client no atributo:

```xml
<Farm Client="{CLIENT_GUID}" ... />
```

Field pode possuir o vínculo com Farm como elemento filho:

```xml
<Field ...>
  <Farm>{FARM_GUID}</Farm>
</Field>
```

O parser do projeto normaliza esses GUIDs para comparação interna.

## TaggedEntity

Entidades espaciais como AdaptiveCurve podem possuir `TaggedEntity`, que identifica a entidade à qual estão associadas quando esse vínculo existe.

Essa relação deve ser resolvida por GUID, não por nome.

## SpatialElement

O código representa elementos espaciais por `SpatialElement`, com informações como:

- `id`
- `guid`
- `name`
- `path`
- `type`
- `compatibility`
- `fieldId` opcional.

`FieldNode` possui coleções de:

- `spatial`
- `adaptiveCurves`
- `abLines`
- `boundaries`
- `flags`

## AdaptiveCurve

AdaptiveCurves são entidades identificadas por GUID. Quando `TaggedEntity` existe, ele pode apontar para um Field.

Os arquivos espaciais observados seguem o padrão:

```
Gen4/SpatialFiles/AdaptiveCurve{GUID}.gjson
```

O vínculo MasterData → GJSON é feito pelo GUID.

## GJSON

Os GJSONs são arquivos espaciais associados às entidades do MasterData. O caminho e o nome físico são parte da estrutura observada, mas não devem ser usados para inferir relações que não estejam presentes nos dados.

## Regra de interpretação

O parser deve preservar relações que existam no XML. Quando uma relação não estiver explícita, não inventar uma associação baseada em nome, ordem ou geometria.
