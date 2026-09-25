# Gen4 Setup Work Format — 600057

## Escopo

Este documento registra somente diferenças observadas entre:

- `600057 Gen4.zip` — Gen4 normal.
- `Setup Work 600057 Gen4.zip` — Golden Reference de Setup Work.

Um item observado neste par não é automaticamente uma regra universal.

## Matriz observada

| Estrutura | Gen4 normal | Setup Work | Classificação |
|---|---:|---:|---|
| MasterData.xml | 1 | 1 | CONFIRMADO |
| SetupFile | 1 | 1 | CONFIRMADO |
| SourceApp | 1 | 1 | CONFIRMADO |
| FileSchemaVersion | 1 | 1 | CONFIRMADO |
| Setup | 1 | 1 | CONFIRMADO |
| Client | 1 | 3 | CONFIRMADO |
| Farm | 6 | 9 | CONFIRMADO |
| Field | 5 | 21 | CONFIRMADO |
| WorkDescriptor | 8 | 0 | CONFIRMADO |
| Operator | 0 | 19 | CONFIRMADO |
| AdaptiveCurve | 5 | 18 | CONFIRMADO |
| ABCurve | 0 | 4 | CONFIRMADO |
| ABLine | 0 | 43 | CONFIRMADO |
| APoint | 0 | 47 | CONFIRMADO |
| BPoint | 0 | 47 | CONFIRMADO |
| Flag | 0 | 2 | CONFIRMADO |
| OperationalBoundary | 0 | 1 | CONFIRMADO |
| RTKBaseStations | 0 | 12 | CONFIRMADO |
| SpatialFiles | 5 GJSON | 25 GJSON | CONFIRMADO |

## Versões

O Gen4 normal analisado possui:

- FileSchemaContentVersion 2.19
- UnitOfMeasureVersion 1.8
- RepresentationSystemVersion 3.13

O Setup Work analisado possui:

- FileSchemaContentVersion 2.34
- UnitOfMeasureVersion 1.140
- RepresentationSystemVersion 4.763

Os valores são específicos dos arquivos analisados. A estrutura de versão é confirmada; a universalidade dos valores é DESCONHECIDA.

## Entidades adicionais observadas

Setup Work possui Operator, ABCurve, ABLine, APoint, BPoint, Flag, OperationalBoundary e RTKBaseStations, enquanto o Gen4 normal fornecido não possui essas entidades.

Isso é CONFIRMADO para o par 600057. A obrigatoriedade de cada entidade em todo Setup Work é DESCONHECIDA.

## WorkDescriptor

O normal possui 8 WorkDescriptors e o Setup Work possui zero. Portanto, WorkDescriptor não pode ser considerado requisito comprovado de Setup Work.

## SpatialFiles

No normal analisado existem 5 GJSONs de AdaptiveCurve.

No Setup Work analisado existem 25 GJSONs:

- 18 AdaptiveCurve;
- 4 ABCurve;
- 2 Flag;
- 1 Boundary.

A correspondência GUID → arquivo é confirmada. A regra genérica para decidir quais entidades devem ser exportadas ainda é DESCONHECIDA.

## Relações comprovadas no Setup Work

Foi observada diretamente a cadeia:

```
Client
  ↓
Farm
  ↓
Field
  ↓
entidade espacial
  ↓
SpatialFiles/{tipo}{GUID}.gjson
```

No contexto UL/600057:

```
Client 7c60197c... UL
  ↓
Farm 8fe70d67... 600057
  ↓
Field d19fc531... 600057
  ↓
AdaptiveCurve P1–P5
```

Também:

```
Field d19fc531...
  ↓
OperationalBoundary f189c58c...
  ↓
Boundary{f189c58c...}.gjson
```

## Específico do Golden Reference

GUIDs, nomes, Operators, Flags, RTKBaseStations, ABCurves, ABLines, datas e versões exatas do 600057 são dados específicos do projeto.

Não copiar esses valores como regras.

## Desconhecido

Ainda não foi comprovado:

1. o algoritmo geral Gen4 normal → Setup Work;
2. quais entidades devem ser selecionadas;
3. como escolher Operator;
4. como selecionar ABLine/ABCurve;
5. se RTKBaseStations são obrigatórias;
6. se todos os Fields devem ser preservados;
7. quais metadados são fixos do formato;
8. quais relações históricas devem ser materializadas.

## Regra de segurança

Quando a relação necessária não estiver comprovada no arquivo de origem, não criar heurística. Marcar como DESCONHECIDO e investigar antes de implementar.
