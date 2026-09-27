# Gen4 Normal → Gen4 Setup Work — Transformation Specification

## 1. Objetivo

Este documento define, exclusivamente a partir do par real **600057 Gen4 normal** → **Setup Work 600057 Gen4** e do código atual do projeto, o que pode ser afirmado sobre a transformação de um projeto Gen4 normal em um arquivo Gen4 Setup Work.

O objetivo desta fase é especificar a transformação mínima defensável **sem implementar o builder**.

Regra principal: uma diferença observada no 600057 não é automaticamente uma regra universal. Cada conclusão é classificada como:

- **CONFIRMADO** — observado diretamente nos arquivos reais ou no código.
- **FORTE EVIDÊNCIA** — sustentado por mais de uma observação, mas ainda sem segunda amostra independente.
- **HIPÓTESE** — explicação plausível sem comprovação suficiente.
- **DESCONHECIDO** — não há evidência suficiente para definir a regra.

---

## 2. Fontes analisadas

### Arquivos reais

1. `600057 Gen4.zip`
   - Gen4 normal.
2. `Setup Work 600057 Gen4.zip`
   - Golden Reference de Setup Work.

### Código atual

Foram considerados, quando relevantes:

- `src/converter/types.ts`
- `src/converter/master-data-parser.ts`
- `src/converter/gen4-parser.ts`
- `src/converter/spatial-data-parser.ts`
- documentação existente em `skills/john-deere-gen4-converter/`

O fluxo Gen4 → GS3 existente é tratado como sistema separado e não é alterado por esta especificação.

---

## 3. Diferenças estruturais confirmadas

A comparação real do par 600057 mostrou:

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

Essas quantidades descrevem somente o projeto 600057.

### Versões observadas

Gen4 normal:

- FileSchemaContentVersion = `2.19`
- UnitOfMeasureVersion = `1.8`
- RepresentationSystemVersion = `3.13`

Setup Work:

- FileSchemaContentVersion = `2.34`
- UnitOfMeasureVersion = `1.140`
- RepresentationSystemVersion = `4.763`

**CONFIRMADO:** as versões diferem entre os dois arquivos.

**DESCONHECIDO:** quais valores de versão devem ser produzidos por um builder genérico para outro projeto.

---

## 4. Matriz Gen4 → Setup Work

| Entidade | Gen4 Normal | Setup Work | Conteúdo preservado? | Ação provável | Dependência | Confiança |
|---|---:|---:|---|---|---|---|
| Client | 1 | 3 | Não determinado para cada GUID | Preservar/criar somente conforme origem | Farm | CONFIRMADO |
| Farm | 6 | 9 | Não determinado para cada GUID | Preservar/criar somente conforme origem | Client/Field | CONFIRMADO |
| Field | 5 | 21 | Não determinado para cada GUID | Preservar/criar somente conforme origem | Farm | CONFIRMADO |
| WorkDescriptor | 8 | 0 | Não aplicável | Não emitir como observado no Golden | Desconhecida | FORTE EVIDÊNCIA |
| Operator | 0 | 19 | Não aplicável | Criar somente se origem equivalente for identificada | Desconhecida | CONFIRMADO |
| AdaptiveCurve | 5 | 18 | Não determinado GUID a GUID nesta especificação | Preservar/criar conforme entidades de origem equivalentes | Field | CONFIRMADO |
| ABCurve | 0 | 4 | Não aplicável | Criar somente quando existir origem equivalente | ABLine/APoint/BPoint ou outra relação | CONFIRMADO |
| ABLine | 0 | 43 | Não aplicável | Criar somente quando existir origem equivalente | A/B points e demais relações | CONFIRMADO |
| APoint | 0 | 47 | Não aplicável | Criar somente quando existir origem equivalente | ABLine/ABCurve | CONFIRMADO |
| BPoint | 0 | 47 | Não aplicável | Criar somente quando existir origem equivalente | ABLine/ABCurve | CONFIRMADO |
| Flag | 0 | 2 | Não aplicável | Criar somente quando existir origem equivalente | Field/espacial | CONFIRMADO |
| OperationalBoundary | 0 | 1 | Não aplicável | Materializar somente quando houver origem equivalente | Field | CONFIRMADO |
| RTKBaseStations | 0 | 12 | Não aplicável | Criar somente quando houver origem equivalente | Desconhecida | CONFIRMADO |
| Crop | Não determinado nesta comparação estrutural | Presença/conteúdo não suficientemente mapeados | Desconhecido | Não alterar sem evidência | MasterData | DESCONHECIDO |
| ChemicalType | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | MasterData | DESCONHECIDO |
| FertilizerType | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | MasterData | DESCONHECIDO |
| MachineType | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | MasterData | DESCONHECIDO |
| ImplementType | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | MasterData | DESCONHECIDO |
| MachineModel | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | Machine/MasterData | DESCONHECIDO |
| Machine | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | MachineModel/Setup | DESCONHECIDO |
| Implement | Não determinado | Não suficientemente mapeado | Desconhecido | Não alterar sem evidência | ImplementType/Machine | DESCONHECIDO |
| FileSchemaContentVersion | 2.19 | 2.34 | Valor alterado | Atualizar conforme versão-alvo, mas regra de seleção do valor é desconhecida | FileSchemaVersion | CONFIRMADO |
| UnitOfMeasureVersion | 1.8 | 1.140 | Valor alterado | Atualizar conforme versão-alvo, regra genérica desconhecida | FileSchemaVersion | CONFIRMADO |
| RepresentationSystemVersion | 3.13 | 4.763 | Valor alterado | Atualizar conforme versão-alvo, regra genérica desconhecida | FileSchemaVersion | CONFIRMADO |
| SourceApp | Presente | Presente | Não determinado campo a campo | Preservar estrutura; valores genéricos ainda não definidos | FileSchemaVersion/Setup | CONFIRMADO |
| MasterData | Presente | Presente | Estrutura geral preservada, conteúdo quantitativo alterado | Transformar conforme entidades efetivamente necessárias | Todas as entidades | CONFIRMADO |
| Relações Client → Farm → Field | Presentes | Presentes | Relação existe em ambos | Preservar relações explícitas por GUID | Hierarquia | FORTE EVIDÊNCIA |
| IDs/GUIDs | Presentes | Presentes | Não determinado para todas as entidades | Preservar GUID de entidades preservadas; gerar somente quando necessário e comprovado | Entidade | CONFIRMADO |
| TaggedEntity | Presente em entidades aplicáveis | Presente em entidades aplicáveis | Relações devem ser cruzadas por GUID | Preservar vínculo explícito | Entidade/Field | CONFIRMADO |
| SpatialFiles | 5 GJSON | 25 GJSON | Não: conjunto diferente | Materializar somente entidades com origem equivalente | MasterData/Spatial | CONFIRMADO |
| Ordem/estrutura XML | Estrutura XML em ambos | Estrutura XML em ambos | Diferenças detalhadas não totalmente mapeadas | Preservar ordem exigida somente após evidência específica | Schema | DESCONHECIDO |
| Obrigatoriedade dos tipos adicionais | Não comprovada | Não comprovada individualmente | — | Não assumir obrigatoriedade universal | Formato | DESCONHECIDO |

### Observação sobre a coluna “Ação provável”

“Ação provável” não é uma autorização de implementação. Ela representa somente a menor interpretação compatível com as evidências atuais.

---

## 5. Entidades preservadas

### Client / Farm / Field

**CONFIRMADO:** os dois arquivos possuem Client, Farm e Field.

**FORTE EVIDÊNCIA:** a hierarquia lógica continua sendo representada por relações entre entidades, e o código atual do parser representa essa estrutura como:

```
ClientNode
  └── FarmNode
        └── FieldNode
```

O parser resolve relações por GUID. Não deve haver seleção por nome, ordem ou geometria.

### AdaptiveCurve

**CONFIRMADO:** ambos possuem AdaptiveCurve.

O normal possui 5; o Setup Work possui 18.

**DESCONHECIDO:** quais das 18 AdaptiveCurves do Golden são correspondentes diretas às 5 AdaptiveCurves do normal e quais representam entidades adicionais do processo de Setup Work.

Portanto, não é defensável implementar “copiar todas” nem “copiar somente as cinco” como regra geral nesta fase.

### IDs e TaggedEntity

**CONFIRMADO:** GUIDs são usados para identificar entidades e estabelecer relações.

**CONFIRMADO:** o código atual normaliza GUIDs e usa relações explícitas do XML.

**FORTE EVIDÊNCIA:** relações futuras devem continuar sendo resolvidas por GUID.

---

## 6. Entidades removidas

### WorkDescriptor

O Gen4 normal possui 8 WorkDescriptors e o Golden Setup Work possui 0.

**CONFIRMADO:** WorkDescriptor não aparece no Golden Setup Work 600057.

**FORTE EVIDÊNCIA:** WorkDescriptor não deve ser tratado como entidade necessária do resultado Setup Work.

**DESCONHECIDO:** se WorkDescriptor deve sempre ser removido em qualquer Setup Work ou se existe algum cenário de Setup Work que possa preservá-lo.

Portanto, a implementação futura não deve simplesmente apagar WorkDescriptor de qualquer arquivo sem primeiro definir o escopo da transformação.

---

## 7. Entidades transformadas

### MasterData

**CONFIRMADO:** MasterData.xml existe nos dois projetos, mas sua composição é diferente.

O Golden possui mais entidades e relações.

A transformação, portanto, não é uma simples cópia binária de MasterData.xml.

### Versionamento

**CONFIRMADO:** os três valores de versão observados mudam.

Isso demonstra uma transformação de metadados/versionamento.

**DESCONHECIDO:** não há evidência suficiente para fixar os valores de versão como constantes universais do builder.

### SpatialFiles

**CONFIRMADO:** o conjunto espacial muda de 5 GJSON para 25 GJSON.

No Golden foram observados:

- 18 AdaptiveCurve;
- 4 ABCurve;
- 2 Flag;
- 1 Boundary.

**CONFIRMADO:** os arquivos espaciais são identificados por GUID e tipo.

**DESCONHECIDO:** a regra que decide quais entidades espaciais adicionais são materializadas para um projeto arbitrário.

---

## 8. Entidades potencialmente criadas

As seguintes entidades aparecem no Setup Work 600057 sem existir no Gen4 normal analisado:

- Operator;
- ABCurve;
- ABLine;
- APoint;
- BPoint;
- Flag;
- OperationalBoundary;
- RTKBaseStations.

**CONFIRMADO:** elas existem no Golden e não existem no normal deste par.

**DESCONHECIDO:** se são criadas pelo processo de geração de Setup Work ou se são dados provenientes de uma fonte anterior que simplesmente não estava presente no Gen4 normal fornecido.

Esse ponto é crítico: a diferença entre “não existe no arquivo normal” e “o transformador deve criar” ainda não foi demonstrada.

Nenhuma dessas entidades deve ser sintetizada em um builder futuro sem uma origem ou regra comprovada.

---

## 9. Entidades opcionais

Não existe evidência suficiente para declarar como obrigatórios, em todo Setup Work:

- Operator;
- ABCurve;
- ABLine;
- APoint;
- BPoint;
- Flag;
- OperationalBoundary;
- RTKBaseStations;
- Crop;
- ChemicalType;
- FertilizerType;
- MachineType;
- ImplementType;
- MachineModel;
- Machine;
- Implement.

**CONFIRMADO:** algumas dessas entidades aparecem no Golden 600057.

**DESCONHECIDO:** se sua presença é requisito estrutural ou apenas consequência dos dados específicos daquele projeto.

---

## 10. Dependências e relacionamentos

### Hierarquia principal

A relação estrutural comprovada é:

```
Client
  ↓
Farm
  ↓
Field
```

O código atual representa essa hierarquia explicitamente em `ClientNode`, `FarmNode` e `FieldNode`.

### Entidades espaciais

A relação observada é:

```
Field
  ↓
Spatial entity
  ↓
SpatialFile/GJSON
```

No código atual:

- `SpatialElement.fieldId` representa o vínculo quando conhecido;
- `FieldNode.spatial` agrupa elementos espaciais;
- `FieldNode.adaptiveCurves`, `abLines`, `boundaries` e `flags` representam subconjuntos.

**CONFIRMADO:** essa estrutura já existe no parser.

### GUID

**CONFIRMADO:** o GUID da entidade é a referência primária.

Não deve ser substituído por:

- nome;
- posição no XML;
- primeiro elemento;
- timestamp;
- geometria;
- SourceNode isoladamente.

---

## 11. Versionamento e metadados

### FileSchemaVersion

Normal:

```
FileSchemaContentVersion = 2.19
UnitOfMeasureVersion = 1.8
RepresentationSystemVersion = 3.13
```

Setup Work:

```
FileSchemaContentVersion = 2.34
UnitOfMeasureVersion = 1.140
RepresentationSystemVersion = 4.763
```

**CONFIRMADO:** os três valores são diferentes.

**DESCONHECIDO:** se a versão-alvo deve ser derivada:

- de uma versão fixa do formato;
- do ambiente de destino;
- de outra informação presente no projeto;
- ou de outra regra ainda não identificada.

### SourceApp

**CONFIRMADO:** SourceApp existe nos dois arquivos.

**DESCONHECIDO:** quais diferenças de conteúdo são semânticas para Setup Work e quais são somente metadata de geração.

Não alterar SourceApp por heurística.

### Ordem XML

**CONFIRMADO:** ambos são XML estruturados.

**DESCONHECIDO:** a ordem exata de todos os elementos que deve ser preservada para compatibilidade do Setup Work.

Um futuro serializer deve reproduzir a ordem somente onde isso for comprovado como requisito.

---

## 12. Hipóteses ainda não comprovadas

As seguintes interpretações permanecem fora da especificação executável:

1. Setup Work sempre deve conter Operator.
2. Setup Work sempre deve conter RTKBaseStations.
3. Setup Work sempre deve conter Boundary.
4. Setup Work sempre deve conter ABLine/ABCurve/APoint/BPoint.
5. As 5 AdaptiveCurves do Gen4 normal são exatamente cinco das 18 AdaptiveCurves do Golden.
6. As entidades adicionais do Golden são necessariamente geradas pelo conversor a partir do Gen4 normal.
7. Todos os Fields do normal devem ser preservados no Setup Work.
8. Os 21 Fields do Golden são resultado de uma regra fixa.
9. Os valores de versão 2.34 / 1.140 / 4.763 são constantes universais.
10. SourceApp possui valores fixos universais.
11. Crop, ChemicalType, FertilizerType, MachineType, ImplementType, MachineModel, Machine e Implement seguem uma transformação estrutural já determinada.
12. A ordem específica do MasterData.xml é semanticamente obrigatória em todos os campos.
13. Qualquer entidade sem origem equivalente pode ser sintetizada com valores padrão.

---

## 13. Pontos que NÃO devem ser implementados ainda

Não implementar nesta fase:

- criação automática de Operators;
- criação automática de RTKBaseStations;
- criação de ABLines;
- criação de ABCurves;
- criação de APoints/BPoints;
- criação de Flags;
- criação de Boundaries;
- criação de Machine/Implement;
- criação ou alteração de Crop/Product metadata;
- regras universais para versões;
- regras baseadas somente no nome 600057;
- seleção do primeiro Client/Farm/Field;
- seleção por timestamp;
- seleção por SourceNode isoladamente;
- geração de entidades sem origem rastreável;
- qualquer alteração no pipeline Gen4 → GS3.

Também não implementar ainda uma regra de “copiar tudo do Golden Reference”.

---

## 14. Critérios necessários antes de iniciar a implementação

Antes de escrever um builder Gen4 normal → Setup Work, é necessário obter evidência suficiente para:

1. Definir qual unidade lógica do Setup Work é transformada:
   - projeto;
   - Client;
   - Farm;
   - Field;
   - conjunto de entidades associado a Field;
   - ou outra estrutura.

2. Determinar a origem de cada entidade adicional:
   - Operator;
   - ABCurve;
   - ABLine;
   - APoint;
   - BPoint;
   - Flag;
   - OperationalBoundary;
   - RTKBaseStations.

3. Cruzar GUIDs entre normal e Golden sempre que possível.

4. Determinar quais entidades são:
   - preservadas;
   - removidas;
   - transformadas;
   - criadas;
   - opcionais.

5. Determinar a origem dos valores de versão.

6. Determinar se SourceApp é:
   - preservado;
   - transformado;
   - regenerado.

7. Determinar a regra de materialização dos SpatialFiles.

8. Definir testes de estrutura contra um Golden Reference.

9. Ter pelo menos uma estratégia explícita para cenários onde a informação de origem não existe.

10. Manter o fluxo Gen4 → GS3 intacto e testado.

---

# MINIMUM VIABLE SETUP WORK STRUCTURE

Esta seção contém **somente elementos para os quais existe evidência suficiente no par real** de que fazem parte da estrutura observada de um Setup Work.

### Estrutura comprovada

```
SetupFile
├── SourceApp
├── FileSchemaVersion
├── Setup
├── MasterData
│   ├── Client
│   ├── Farm
│   ├── Field
│   └── entidades espaciais/relacionadas
└── SpatialFiles
    └── GJSONs associados às entidades espaciais
```

### Mínimo estrutural defensável

1. **SetupFile / MasterData.xml**
   - CONFIRMADO.

2. **SourceApp**
   - CONFIRMADO como parte do arquivo.
   - Conteúdo-alvo genérico ainda DESCONHECIDO.

3. **FileSchemaVersion**
   - CONFIRMADO como parte do arquivo.
   - Valores universais ainda DESCONHECIDOS.

4. **Setup**
   - CONFIRMADO.

5. **Client → Farm → Field**
   - CONFIRMADO como estrutura hierárquica presente.
   - A quantidade de entidades para um novo projeto é DESCONHECIDA.

6. **GUIDs e referências explícitas**
   - CONFIRMADO.

7. **SpatialFiles**
   - CONFIRMADO como parte do Golden.
   - Quais tipos devem existir em cada projeto ainda é DESCONHECIDO.

### O que deliberadamente não entra no mínimo

Não entram como requisitos mínimos comprovados:

- Operator;
- ABLine;
- ABCurve;
- APoint;
- BPoint;
- Flag;
- OperationalBoundary;
- RTKBaseStations;
- Machine;
- Implement;
- Crop;
- ChemicalType;
- FertilizerType;
- MachineType;
- ImplementType;
- MachineModel;
- quantidades específicas do 600057;
- versões específicas do 600057;
- GUIDs específicos do Golden;
- valores específicos de SourceApp.

A razão é simples: sua presença no Golden 600057 é **CONFIRMADA**, mas sua obrigatoriedade para um Setup Work genérico ainda é **DESCONHECIDA**.

---

## Resumo de classificação

A contagem abaixo considera os **31 itens de decisão da matriz e seus registros estruturais principais**, não cada frase do documento:

- **CONFIRMADO:** 20
- **FORTE EVIDÊNCIA:** 2
- **HIPÓTESE:** 0
- **DESCONHECIDO:** 9

A ausência de hipóteses na matriz é intencional: quando a evidência não permite decidir, o item foi marcado como DESCONHECIDO em vez de receber uma regra especulativa.

## Estado da implementação

Esta especificação **não implementa** Gen4 normal → Gen4 Setup Work.

Não altera:

- `gs3-project-builder.ts`
- `point-selector.ts`
- `fdshape-encoder.ts`
- `spatial-catalog-builder.ts`
- `water-management-builder.ts`
- `zip-exporter.ts`
- `converter-app.tsx`
- testes existentes
- fluxo Gen4 → GS3
