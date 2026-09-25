# Gen4 Normal → Gen4 Setup Work — Fase 1

## Escopo

Comparação estrutural dos arquivos reais:

- `600057 Gen4(1).zip` — projeto Gen4 normal.
- `Setup Work 600057 Gen4(1).zip` — projeto Gen4 Setup Work de referência.

Esta fase é exclusivamente diagnóstica. Nenhum conversor foi implementado e nenhum arquivo da implementação Gen4 → GS3 foi alterado.

## 1. Matriz Normal × Setup Work

| Elemento | Gen4 normal | Gen4 Setup Work | Classificação |
|---|---:|---:|---|
| `MasterData.xml` | 1 | 1 | A |
| `SetupFile` | 1 | 1 | A |
| `SourceApp` | 1 | 1 | A |
| `FileSchemaVersion` | 1 | 1 | A |
| `Setup` | 1 | 1 | A |
| Client | 1 | 3 | A |
| Farm | 6 | 9 | A |
| Field | 5 | 21 | A |
| WorkDescriptor | 8 | 0 | C |
| Operator | 0 | 19 | A |
| AdaptiveCurve | 5 | 18 | A |
| ABCurve | 0 | 4 | A |
| ABLine | 0 | 43 | A |
| APoint | 0 | 47 | A |
| BPoint | 0 | 47 | A |
| Flag | 0 | 2 | A |
| OperationalBoundary | 0 | 1 | A |
| RTKBaseStations | 0 | 12 | A |
| SpatialFiles | 5 GJSON | 25 GJSON | A |

**Interpretação:** A significa que a estrutura foi observada diretamente no Setup Work real e, portanto, é parte comprovada desse formato/projeto. Isso não significa que toda instância futura de Setup Work terá necessariamente a mesma quantidade ou todas as mesmas entidades.

B significa entidade/valor específico do projeto de referência, quando não há evidência suficiente para elevá-lo a requisito do formato.

C significa comportamento ou relação ainda não determinado.

## 2. FileSchemaVersion

### Gen4 normal

```xml
<SourceApp minor="0" major="0" build="0" revision="0"
           nameSourceApp="" SourceAppClientId="" />

<FileSchemaVersion nonProductionCode="0">
  <FileSchemaContentVersion major="2" minor="19" />
  <UnitOfMeasureVersion major="1" minor="8" />
  <RepresentationSystemVersion major="3" minor="13" />
</FileSchemaVersion>
```

### Gen4 Setup Work

```xml
<SourceApp revision="101"
           SourceAppClientId="0oa2fritacfLfmDjl5d7"
           nameSourceApp="G5 Universal"
           major="10"
           build="3422"
           minor="29" />

<FileSchemaVersion nonProductionCode="0">
  <FileSchemaContentVersion major="2" minor="34" />
  <UnitOfMeasureVersion major="1" minor="140" />
  <RepresentationSystemVersion major="4" minor="763" />
</FileSchemaVersion>
```

**Conclusão:** os dois arquivos usam a mesma família estrutural `SetupFile → SourceApp → FileSchemaVersion → Setup`, mas não usam as mesmas versões nem os mesmos metadados de origem.

Classificação: **A — estrutura comprovada.** Os valores exatos de versão são **B**, pois pertencem aos arquivos analisados e não foram demonstrados como universais.

## 3. Client → Farm → Field

### Gen4 normal

Existe um único Client:

- `c8679051-39ab-42ed-bb32-e724df5df90a` — `Colheita`

Existe um Farm principal:

- `14f68c35-5d87-1af1-282a-6234679c1fba` — `600057`
- atributo `Client="c8679051-39ab-42ed-bb32-e724df5df90a"`

Os 5 Fields possuem o vínculo Farm como elemento filho:

```xml
<Field ... Name="1">
  <Farm>14f68c35-5d87-1af1-282a-6234679c1fba</Farm>
</Field>
```

e equivalentes para Fields 2, 3, 4 e 5.

### Gen4 Setup Work

Foram encontrados 3 Clients:

- `0671af79-2ecc-4847-be79-fcd80306100d` — Transbordo
- `4bc4b93c-26de-4082-bb06-a6433ea1ff51` — Colheita
- `7c60197c-4efb-4027-bc2c-4c9780630ff1` — UL

Entre os Farms relevantes:

- `220c56f8-4773-a1d3-1217-65e2a1ed146f` — 600057 → Client Transbordo
- `9604cf6f-cf2c-65f0-eef9-57f8663ac14c` — 600022 → Client Colheita
- `8fe70d67-3315-9d41-f740-d5d9b39f138b` — 600057 → Client UL

O Field do contexto UL é:

- `d19fc531-a9fe-76e3-5146-f081c2c1bfe8` — 600057
- Farm `8fe70d67-3315-9d41-f740-d5d9b39f138b`

O Setup Work também contém Fields históricos/adicionais sem vínculo Farm explícito no próprio elemento, além dos Fields vinculados aos Farms acima.

Classificação: **A para a hierarquia Client/Farm/Field; B para os valores específicos de 600057.**

## 4. AdaptiveCurve

### Normal

Existem exatamente 5 AdaptiveCurves, todas com `TaggedEntity` apontando para um dos 5 Fields:

| AdaptiveCurve | Field |
|---|---|
| `ad17dd30-5f5e-42df-b72e-5a3e814c0197` | Field 1 |
| `2d75be1c-864a-486e-bfea-f3a65f207b75` | Field 2 |
| `b93e1691-d053-4b25-9759-f933d7642e56` | Field 3 |
| `3d50afd5-a5b5-4592-9c66-8d113ff99b52` | Field 4 |
| `7d88f221-56ad-428f-bcd3-8c46d19d2155` | Field 5 |

### Setup Work

Existem 18 AdaptiveCurves.

Entre elas estão as cinco curvas do contexto UL:

- `c63268f1-5a2e-4f2e-bdce-0e8002ba368a` — P1
- `9f8d31ae-de91-48aa-a2d9-2f8fe2a0bb2a` — P2
- `748f242a-fb47-4385-bdb0-285fe5ae70bb` — P3
- `a23b916c-b099-42ff-910e-ab881ebf49ff` — P4
- `7f5c29a6-7a59-48d1-9b6d-75f3526f7868` — P5

Todas possuem `TaggedEntity=d19fc531-a9fe-76e3-5146-f081c2c1bfe8`.

Também existem AdaptiveCurves vinculadas aos Fields do contexto Transbordo, por exemplo:

- `f774faca-15c3-4e09-9090-b311a4dd3479` → Field 2
- `3af5362a-d581-48cd-9277-a231d79edad6` → Field 3
- `69dd93bc-7967-448c-b417-31b39461dd13` → Field 3
- `71df1896-0bb3-4916-9db9-fce660af4aaf` → Field 4
- `9bd6f682-a176-422f-bf6f-cfcb53851976` → outro Field 3

Há ainda AdaptiveCurves sem `TaggedEntity` no XML analisado.

**Conclusão:** a presença de AdaptiveCurves não é, por si só, suficiente para identificar um único contexto Setup Work. A associação por `TaggedEntity` é uma relação estrutural observada diretamente.

Classificação: **A para a relação AdaptiveCurve → Field quando `TaggedEntity` existe; C para a semântica das curvas sem TaggedEntity.**

## 5. WorkDescriptor

O Gen4 normal possui 8 WorkDescriptors, incluindo:

- Prim. Colh. Algodão
- Colheita
- Plantio
- Pulv. Pós-emersão
- Pulv. Pré-emersão
- Seg. Colh. Algodão
- Semeadura
- Cultivo

O Setup Work analisado possui **0 WorkDescriptor**.

Portanto, não é possível afirmar que WorkDescriptor seja requisito de Setup Work. O comportamento observado é exatamente o oposto neste par.

Classificação: **C** quanto à semântica futura; diferença estrutural direta: **normal possui, Setup Work não possui**.

## 6. Operator

Normal: 0.

Setup Work: 19.

Os Operators possuem `StringGuid`, `Name`, datas e, em vários casos, `SourceNode`/`LastModifiedNode`. O primeiro exemplo é:

- `91ce58fd-00f8-41a9-b31b-7f0f35f64a6c` — Wirlan

Não há evidência neste único par de qual Operator deve ser escolhido para um futuro Setup Work genérico.

Classificação: **A — entidade observada no Setup Work; B/C para valores e regra de seleção.**

## 7. ABCurve / ABLine / APoint / BPoint

Essas entidades aparecem somente no Setup Work analisado:

- ABCurve: 4
- ABLine: 43
- APoint: 47
- BPoint: 47

Os ABLine possuem estruturas internas com:

- SpatialProjection
- APoint
- BPoint
- SaveMethod
- Heading
- OriginalTrackSpacing

Não existem essas entidades no Gen4 normal fornecido.

Isso comprova que o Setup Work pode carregar guidance/AB-line data, mas **não comprova que qualquer Setup Work futuro deverá possuir esses mesmos objetos ou quantidades**.

Classificação: **A — estrutura suportada/observada; B — entidades concretas do projeto; C — regra de inclusão futura.**

## 8. Flag

Setup Work:

- 2 Flags;
- ambos possuem `TaggedEntity=d19fc531-a9fe-76e3-5146-f081c2c1bfe8`;
- ambos possuem `StringGuid`, `FlagCategory`, `Geometry` e metadados de origem.

Normal: 0 Flags.

Os dois Flags são claramente associados ao Field 600057/UL neste projeto.

Classificação: **A — entidade suportada; B — os dois Flags concretos; C — critério futuro para inclusão.**

## 9. OperationalBoundary

Setup Work possui:

- GUID `f189c58c-d262-ca14-f26c-4603e48f4a4f`
- Name `600057`
- TaggedEntity `d19fc531-a9fe-76e3-5146-f081c2c1bfe8`
- Geometry
- SignalType
- VersionDelimiter
- VersionsEnd

Normal não possui OperationalBoundary no MasterData.xml.

O arquivo correspondente no Setup Work é:

`Gen4/SpatialFiles/Boundary{f189c58c-d262-ca14-f26c-4603e48f4a4f}.gjson`

Classificação: **A — estrutura diretamente observada; B — GUID/nome/geometria específicos; C — regra genérica de seleção ainda não determinada.**

## 10. RTKBaseStations

Normal: 0.

Setup Work: 12.

Cada entrada contém metadados como:

- StringGuid
- Name
- CreationDate
- SourceNode/LastModifiedNode
- RadioConnection em várias entradas

O conjunto parece representar dados persistidos de infraestrutura RTK, mas este par isolado não permite concluir quais devem ser incluídos em um Setup Work futuro nem como relacioná-los ao contexto selecionado.

Classificação: **A — entidade observada no Setup Work; C — regra de associação/seleção.**

## 11. SpatialFiles

### Normal

8 entradas ZIP no total:

- diretório `Gen4/`
- `MasterData.xml`
- diretório `Gen4/SpatialFiles/`
- 5 GJSON de AdaptiveCurve.

Os 5 GJSON seguem o padrão:

`AdaptiveCurve{GUID sem chaves}.gjson`

e correspondem às 5 AdaptiveCurves do MasterData.

### Setup Work

28 entradas ZIP no total:

- diretório `Gen4/`
- `MasterData.xml`
- diretório `Gen4/SpatialFiles/`
- 25 GJSON.

Os 25 GJSON são:

- 18 AdaptiveCurve
- 4 ABCurve
- 2 Flag
- 1 Boundary

Isso demonstra que o Setup Work real contém uma camada espacial muito mais ampla que o projeto normal fornecido.

Classificação: **A — organização `Gen4/SpatialFiles` e correspondência GUID → arquivo; B — conjunto específico de arquivos; C — regra de seleção futura.**

## 12. Relações espaciais comprovadas

O padrão estrutural diretamente observado no Setup Work é:

```
Client
  ↓ Client
Farm
  ↓ Farm / TaggedEntity
Field
  ↓ TaggedEntity
entidade MasterData
  ↓ GUID
SpatialFiles/{EntityType}{GUID}.gjson
```

Para o contexto UL:

```
Client 7c60197c... (UL)
        ↓
Farm 8fe70d67... (600057)
        ↓
Field d19fc531... (600057)
        ↓
AdaptiveCurve P1–P5
        ↓
AdaptiveCurve{GUID}.gjson

Field d19fc531...
        ↓
OperationalBoundary f189c58c...
        ↓
Boundary{f189c58c...}.gjson
```

Essa cadeia é **evidência direta**, não uma inferência baseada em nomes.

## 13. Normal × Setup Work — principais diferenças

### Presentes no normal e também no Setup Work

- SetupFile
- SourceApp
- FileSchemaVersion
- Setup
- Client
- Farm
- Field
- AdaptiveCurve
- SpatialFiles
- Geometry/SpatialProjection associadas a AdaptiveCurve

Classificação: **A**, como estruturas comuns observadas nos dois arquivos.

### Presentes no normal e ausentes no Setup Work

- WorkDescriptor (8 no normal; 0 no Setup Work)

Isso demonstra que WorkDescriptor não pode ser assumido como requisito universal de Setup Work.

### Presentes no Setup Work e ausentes no normal

- Operator
- ABCurve
- ABLine
- APoint
- BPoint
- Flag
- OperationalBoundary
- RTKBaseStations
- 3 Clients em vez de 1
- 9 Farms em vez de 6
- 21 Fields em vez de 5
- 18 AdaptiveCurves em vez de 5

Essas diferenças são fatos observados nos dois arquivos.

## 14. Elementos específicos do projeto 600057

Os seguintes valores são específicos deste Golden Reference e não devem ser copiados como regra:

- Client UL e seu GUID;
- Farm 600057/UL e seu GUID;
- Field 600057/UL e seu GUID;
- Boundary GUID;
- GUIDs P1–P5;
- Flags concretos;
- Operators concretos;
- RTKBaseStations concretas;
- ABCurves/ABLines concretos;
- nomes e datas;
- versões exatas do arquivo;
- SourceApp `G5 Universal` e seus valores exatos.

Classificação: **B**.

## 15. Pontos ainda desconhecidos

Ainda não está comprovado:

1. Qual entidade/critério transforma um Gen4 normal em Setup Work.
2. Se Setup Work sempre contém Operator.
3. Se Setup Work sempre contém ABLine/ABCurve.
4. Se RTKBaseStations são obrigatórias.
5. Como escolher quais entidades históricas do MasterData devem entrar no Setup Work.
6. Se todos os Fields de um Setup Work devem ser preservados ou somente um contexto.
7. Qual regra determina quais SpatialFiles entram.
8. Qual regra determina a seleção de um Operator.
9. Qual regra determina quais Flags/ABLines/ABCurves pertencem ao contexto.
10. Quais metadados de versão são fixos do formato e quais são gerados pela aplicação.
11. Se os valores de SourceApp/SourceNode são requisitos funcionais ou apenas metadados de origem.

Classificação: **C**.

## 16. Proposta de estrutura mínima para um futuro Setup Work genérico

Com base somente no que é diretamente comprovado, a estrutura mínima defensável para investigação futura é:

```
Gen4/
├── MasterData.xml
└── SpatialFiles/
    ├── entidades espaciais selecionadas
    └── arquivos referenciados por GUID
```

Dentro do MasterData:

```
SetupFile
├── SourceApp
├── FileSchemaVersion
└── Setup
    ├── Client
    ├── Farm
    ├── Field
    ├── entidades do contexto selecionado
    └── referências espaciais correspondentes
```

Isso é uma **proposta arquitetural mínima**, não uma regra final de geração.

Não é defensável neste momento afirmar que Operator, ABLine, RTKBaseStation, Flag ou Boundary sejam obrigatórios em todos os Setup Works sem outro par real ou documentação do formato.

## 17. Arquivos que um futuro builder deverá considerar

O futuro builder deverá, no mínimo, ter capacidade arquitetural para produzir:

1. `MasterData.xml`
2. `Gen4/SpatialFiles/`
3. GJSONs das entidades espaciais selecionadas.

E deverá estar preparado para entidades observadas neste Golden Reference:

- AdaptiveCurve GJSON
- ABCurve GJSON
- Flag GJSON
- Boundary GJSON

A inclusão de cada entidade deverá depender de uma relação real encontrada na origem, e não de cópia de GUIDs/nomes do projeto 600057.

## 18. Conclusão da Fase 1

O dado mais importante desta comparação é que **Setup Work não parece ser apenas um Gen4 normal com um subconjunto das AdaptiveCurves**.

O Golden Reference contém uma estrutura de dados muito mais rica, incluindo Operators, guidance AB, Flags, OperationalBoundary e RTKBaseStations, enquanto simultaneamente não contém WorkDescriptors presentes no Gen4 normal.

Portanto, antes de implementar um builder Gen4 → Gen4 Setup Work, é necessário separar:

- **estrutura do formato Setup Work**, que já foi observada;
- **entidades concretas do projeto 600057**, que não devem ser copiadas;
- **regra de seleção/transformação**, que ainda não foi determinada.

A evidência disponível nesta fase permite implementar futuramente uma arquitetura baseada em entidades e relações, mas **não permite ainda definir o algoritmo completo de transformação de qualquer Gen4 normal para Setup Work sem introduzir heurísticas**.

## Integridade da implementação GS3

Nesta fase de análise, não foram modificados:

- `gs3-project-builder.ts`
- `fdshape-encoder.ts`
- `point-selector.ts`
- `spatial-catalog-builder.ts`
- `water-management-builder.ts`
- `zip-exporter.ts`
- `converter-app.tsx`

Nenhum código do conversor Gen4 → GS3 foi alterado.
