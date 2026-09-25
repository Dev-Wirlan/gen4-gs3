# Gen4 → Gen4 Setup Work

## 1. Objetivo

Esta SKILL orienta a análise, implementação, testes e evolução do fluxo:

**Gen4 Normal → Gen4 Setup Work**

Ela é específica deste fluxo e deve permanecer isolada do pipeline já validado:

**Gen4 → GS3**

A fonte principal para decisões de transformação é:

- `skills/john-deere-gen4-converter/references/setup-work-transformation-spec.md`

A SKILL não autoriza implementar uma regra que ainda esteja classificada como DESCONHECIDO.

---

## 2. Princípios

### Evidência antes de implementação

Toda transformação deve partir de evidência rastreável em:

- arquivos Gen4 reais;
- Golden References;
- código existente;
- testes reproduzíveis.

Não inventar formato para preencher lacunas.

### Golden Reference

O Golden Reference de Setup Work 600057 é uma referência estrutural real.

Ele deve ser usado para:

- observar estrutura;
- comparar entidades;
- cruzar GUIDs;
- verificar arquivos e relações;
- validar resultados.

Ele **não** deve ser tratado como template universal.

Não copiar automaticamente:

- GUIDs;
- nomes;
- timestamps;
- quantidades;
- Operators;
- Flags;
- RTKBaseStations;
- ABLines;
- ABCurves;
- APoints;
- BPoints;
- Boundary;
- versões;
- SourceApp;
- ou qualquer outro dado específico do 600057.

### Isolamento de branches

O desenvolvimento deste fluxo ocorre exclusivamente em:

`feature/gen4-setup-work`

Não alterar silenciosamente:

- `main`;
- `fix/explicit-field-selection`.

### Isolamento do pipeline GS3

Gen4 → Gen4 Setup Work e Gen4 → GS3 são fluxos diferentes.

O desenvolvimento Setup Work não deve alterar o comportamento validado de:

- seleção explícita de Field do GS3;
- PointSelector;
- regra de 1e-7°;
- CoordinateTransformer;
- FDShape encoder;
- SpatialCatalog GS3;
- WaterManagement GS3;
- ZIP exporter;
- UI do conversor GS3.

### Preservação dos dados de entrada

Uma entidade legítima do projeto de entrada não deve ser removida ou transformada sem evidência de que o formato Setup Work exige isso.

Da mesma forma, uma entidade que aparece somente no Golden não deve ser criada automaticamente sem uma origem ou regra comprovada.

### Mudanças mínimas

Quando uma transformação for comprovada:

1. alterar somente o ponto arquitetural necessário;
2. manter parser e modelos existentes quando semanticamente adequados;
3. isolar a lógica Setup Work em builder próprio;
4. evitar refatorações não relacionadas;
5. adicionar testes para o comportamento novo.

### Rastreabilidade

Toda regra implementada deve poder responder:

1. qual é a fonte da regra;
2. qual entidade de entrada participa;
3. qual entidade de saída é produzida;
4. qual relação por GUID é usada;
5. qual teste comprova o comportamento.

---

## 3. Classificação de evidências

Toda conclusão deve receber uma das quatro classificações.

### CONFIRMADO

Observado diretamente em arquivo real, código ou teste reproduzível.

Tratamento:

- pode fundamentar uma implementação;
- ainda deve ser aplicado somente no escopo demonstrado;
- não deve ser generalizado além da evidência.

### FORTE EVIDÊNCIA

Sustentado por múltiplas observações, mas ainda sem demonstração suficiente de que seja uma regra universal.

Tratamento:

- pode orientar investigação e desenho;
- não deve ser promovido silenciosamente a regra universal;
- se for implementado, o risco e a limitação devem estar documentados.

### HIPÓTESE

Explicação plausível ainda não comprovada.

Tratamento:

- não implementar como fato;
- criar investigação ou teste para tentar confirmá-la;
- registrar claramente a hipótese.

### DESCONHECIDO

Não existe evidência suficiente para definir a regra.

Tratamento:

- não implementar;
- não preencher a lacuna por conhecimento externo sem declarar a fonte;
- investigar antes de codificar.

**Regra:** nunca converter automaticamente FORTE EVIDÊNCIA, HIPÓTESE ou DESCONHECIDO em CONFIRMADO.

---

## 4. Fontes de verdade

### Especificação da transformação

`references/setup-work-transformation-spec.md`

É a fonte principal desta SKILL. Contém a matriz Gen4 Normal × Setup Work e as classificações atuais.

### SKILL geral do projeto

`skills/john-deere-gen4-converter/SKILL.md`

Define regras gerais de evidência, Golden Reference, branches, testes e isolamento.

### Formato Gen4

`references/gen4-format.md`

Contém o conhecimento confirmado sobre:

- MasterData.xml;
- Client;
- Farm;
- Field;
- TaggedEntity;
- SpatialElement;
- AdaptiveCurve;
- GJSON;
- relações hierárquicas.

### Formato Setup Work

`references/setup-work-format.md`

Registra somente diferenças observadas entre:

- `600057 Gen4.zip`;
- `Setup Work 600057 Gen4.zip`.

### Formato GS3

`references/gs3-format.md`

Serve para proteger o conhecimento e o comportamento já validado do fluxo Gen4 → GS3.

### Golden References

`references/golden-references.md`

Registra os arquivos Golden disponíveis e o que cada um comprova.

Quando documentos conflitarem, não escolher silenciosamente: marcar a questão como **DESCONHECIDA** e investigar.

---

## 5. Estrutura Gen4 Normal conhecida

O Gen4 analisado possui um `SetupFile` com estruturas como:

- `SourceApp`;
- `FileSchemaVersion`;
- `Setup`;
- `Client`;
- `Farm`;
- `Field`;
- entidades espaciais;
- arquivos GJSON.

A hierarquia confirmada é:

```
Client
  ↓
Farm
  ↓
Field
  ↓
entidade espacial
  ↓
SpatialFile / GJSON
```

As relações devem ser resolvidas por GUID.

No conhecimento confirmado do projeto:

- Farm pode referenciar Client pelo atributo `Client`;
- Field pode referenciar Farm pelo elemento filho `<Farm>`;
- entidades espaciais podem usar `TaggedEntity`;
- `FieldNode` possui coleções de entidades espaciais.

Não inferir relações por nome, ordem ou geometria quando uma relação explícita não existir.

---

## 6. Estrutura Setup Work conhecida

No par real 600057, o Setup Work contém:

- `MasterData.xml`;
- `SetupFile`;
- `SourceApp`;
- `FileSchemaVersion`;
- `Setup`;
- Client;
- Farm;
- Field;
- entidades espaciais;
- SpatialFiles.

Diferenças confirmadas no par:

| Estrutura | Gen4 Normal | Setup Work |
|---|---:|---:|
| Client | 1 | 3 |
| Farm | 6 | 9 |
| Field | 5 | 21 |
| WorkDescriptor | 8 | 0 |
| Operator | 0 | 19 |
| AdaptiveCurve | 5 | 18 |
| ABCurve | 0 | 4 |
| ABLine | 0 | 43 |
| APoint | 0 | 47 |
| BPoint | 0 | 47 |
| Flag | 0 | 2 |
| OperationalBoundary | 0 | 1 |
| RTKBaseStations | 0 | 12 |
| SpatialFiles | 5 GJSON | 25 GJSON |

Essas quantidades são **CONFIRMADAS para 600057**, não requisitos universais.

---

## 7. Matriz de transformação

A matriz abaixo deve ser interpretada junto com a especificação de transformação. "Observado" não significa "obrigatório".

| Entidade | Estado conhecido | Regra para implementação |
|---|---|---|
| Client | CONFIRMADO em ambos | Preservar/criar somente conforme origem e relações comprovadas |
| Farm | CONFIRMADO em ambos | Preservar relações explícitas por GUID |
| Field | CONFIRMADO em ambos | Preservar relações explícitas por GUID |
| WorkDescriptor | 8 → 0; FORTE EVIDÊNCIA de ausência no Golden | Não assumir que deve ser preservado; regra universal ainda não comprovada |
| Operator | 0 → 19 | Presença confirmada no Golden; origem/obrigatoriedade desconhecidas |
| AdaptiveCurve | 5 → 18 | Correspondência e transformação ainda desconhecidas |
| ABCurve | 0 → 4 | Origem/obrigatoriedade desconhecidas |
| ABLine | 0 → 43 | Origem/obrigatoriedade desconhecidas |
| APoint | 0 → 47 | Origem/obrigatoriedade desconhecidas |
| BPoint | 0 → 47 | Origem/obrigatoriedade desconhecidas |
| Flag | 0 → 2 | Origem/obrigatoriedade desconhecidas |
| OperationalBoundary | 0 → 1 | Origem conhecida no Golden; obrigatoriedade universal desconhecida |
| RTKBaseStations | 0 → 12 | Origem/obrigatoriedade desconhecidas |
| Crop | Não suficientemente mapeado | Não alterar sem evidência |
| ChemicalType | Não suficientemente mapeado | Não alterar sem evidência |
| FertilizerType | Não suficientemente mapeado | Não alterar sem evidência |
| MachineType | Não suficientemente mapeado | Não alterar sem evidência |
| ImplementType | Não suficientemente mapeado | Não alterar sem evidência |
| MachineModel | Não suficientemente mapeado | Não alterar sem evidência |
| Machine | Não suficientemente mapeado | Não alterar sem evidência |
| Implement | Não suficientemente mapeado | Não alterar sem evidência |
| SpatialFiles | 5 → 25 | Materializar somente quando a entidade e sua origem estiverem comprovadas |

### Regra operacional da matriz

Quando a coluna de implementação indicar origem desconhecida:

**não implementar.**

A próxima ação deve ser investigação, não heurística.

---

## 8. Regras atualmente confirmadas

As seguintes regras podem ser usadas como base arquitetural:

1. O fluxo Setup Work deve permanecer separado do fluxo GS3.
2. Client, Farm e Field possuem relações hierárquicas explícitas por GUID.
3. GUID é a referência principal para cruzamento de entidades.
4. TaggedEntity deve ser interpretado como vínculo explícito quando presente.
5. SpatialFiles são associados às entidades por identificadores explícitos.
6. O Golden Reference pode comprovar que uma estrutura existe, mas uma única amostra não comprova sua obrigatoriedade universal.
7. WorkDescriptor não aparece no Golden 600057.
8. O conjunto espacial do Golden 600057 é diferente do conjunto do Gen4 normal.
9. As versões de schema observadas mudam entre normal e Setup Work.
10. Os valores específicos de 600057 não devem ser hard-coded em uma transformação genérica.

### O que não é uma regra confirmada

Não são regras confirmadas:

- "sempre criar 19 Operators";
- "sempre criar 12 RTKBaseStations";
- "sempre criar 21 Fields";
- "sempre criar Boundary";
- "sempre criar ABLine";
- "sempre converter 5 AdaptiveCurves em 18";
- "sempre usar as versões 2.34 / 1.140 / 4.763";
- "sempre copiar o SourceApp do Golden";
- "sempre remover WorkDescriptor".

Essas afirmações exigem evidência adicional antes de serem universalizadas.

---

## 9. Regras ainda desconhecidas

Antes da implementação geral ainda é necessário determinar:

- como entidades adicionais do Setup Work são originadas;
- como Operators são escolhidos ou criados;
- como ABLine/ABCurve/APoint/BPoint são originados;
- como Flags são originadas;
- como RTKBaseStations são originadas;
- quando OperationalBoundary é obrigatória;
- como as 5 AdaptiveCurves do normal se relacionam às 18 do Golden;
- se todos os Fields de entrada devem ser preservados;
- como versões devem ser determinadas;
- quais campos de SourceApp são transformados;
- como MasterData adicional deve ser tratado;
- quais entidades de Machine/Implement e tipos de produto participam da transformação;
- quais SpatialFiles são obrigatórios em um Setup Work genérico;
- se a ordem exata de todos os elementos XML é requisito do formato.

Enquanto esses pontos permanecerem DESCONHECIDOS, não criar uma regra automática para eles.

---

## 10. Estratégia de implementação futura

Quando houver evidência suficiente, a implementação deve ser isolada em um builder próprio para Setup Work.

Arquitetura conceitual:

```
Gen4 Normal
    ↓
parser existente / modelo neutro
    ↓
Setup Work transformation context
    ↓
Setup Work builder
    ↓
MasterData.xml + SpatialFiles
    ↓
Gen4 Setup Work ZIP
```

O builder deve:

- receber os dados reais do projeto de entrada;
- preservar entidades válidas quando comprovado;
- transformar somente o necessário;
- gerar entidades adicionais somente quando sua origem/regra estiver comprovada;
- usar GUIDs reais das entidades;
- evitar hard-code de 600057;
- evitar seleção pelo primeiro elemento;
- evitar seleção por nome isolado;
- evitar timestamp como heurística;
- evitar SourceNode isoladamente;
- evitar heurística geométrica;
- não copiar cegamente o Golden;
- manter o pipeline GS3 intacto;
- possuir testes específicos;
- permitir validação contra projetos reais.

### Reutilização de código

Código do GS3 pode ser reutilizado somente quando a semântica for comprovadamente a mesma.

Não reutilizar silenciosamente uma função apenas porque os dados parecem semelhantes.

Se uma abstração compartilhada for necessária, primeiro demonstrar:

1. mesma entrada semântica;
2. mesmo significado;
3. mesmo contrato;
4. ausência de regressão no GS3.

---

## 11. Golden Reference

O Golden Setup Work 600057 deve ser tratado como:

**referência estrutural e de comparação**, não como template universal.

Usos permitidos:

- comparar presença/ausência;
- cruzar GUIDs;
- estudar relações;
- comparar XML;
- comparar SpatialFiles;
- validar uma implementação quando a regra correspondente estiver comprovada.

Usos proibidos sem evidência adicional:

- copiar GUIDs para qualquer novo projeto;
- copiar nomes do 600057;
- copiar quantidades;
- assumir Operators padrão;
- assumir RTKBaseStations padrão;
- assumir Boundary obrigatório;
- assumir versões como constantes universais;
- gerar entidades sem origem rastreável.

---

## 12. Critérios antes de alterar código

Antes de qualquer mudança funcional:

1. identificar a entidade;
2. localizar a evidência no arquivo real ou código;
3. classificar a evidência;
4. cruzar GUIDs e relações;
5. separar dado específico de regra estrutural;
6. definir a transformação;
7. identificar dependências;
8. definir o comportamento quando a origem estiver ausente;
9. definir teste;
10. verificar que a mudança não afeta Gen4 → GS3;
11. somente então editar código.

Se qualquer etapa crítica permanecer DESCONHECIDA, a ação padrão é continuar investigando.

---

## 13. Testes

Toda implementação futura deve incluir, conforme o escopo:

### Testes unitários

Validar:

- preservação de GUIDs;
- relações Client → Farm → Field;
- transformação de cada entidade comprovada;
- ausência de entidades que comprovadamente devem ser removidas;
- serialização XML;
- referências entre MasterData e SpatialFiles.

### Testes de integração

Quando houver múltiplos componentes envolvidos, validar:

- parser → transformation context;
- transformation context → builder;
- builder → ZIP;
- referências cruzadas.

### Build

Executar:

```bash
npm.cmd run build
```

### Testes automatizados

Executar:

```bash
npm.cmd test -- --run
```

### Golden Reference

Quando existir regra comprovada correspondente:

- converter um projeto real;
- inspecionar estrutura do ZIP;
- comparar XML;
- comparar entidades por GUID;
- comparar arquivos espaciais;
- comparar bytes quando a equivalência byte-a-byte for um critério válido.

### Projeto real

Sempre que aplicável, testar com um Gen4 real.

Não considerar um fixture sintético suficiente para validar uma transformação estrutural complexa sem justificativa.

### Equipamento/software real

Quando disponível, validar o resultado no ambiente John Deere real correspondente.

---

## 14. Segurança contra regressão

O desenvolvimento desta SKILL não autoriza mudanças no fluxo Gen4 → GS3.

Antes de qualquer implementação que compartilhe código:

1. executar os testes existentes;
2. executar o build;
3. revisar o diff;
4. confirmar que os arquivos GS3 não foram alterados sem necessidade;
5. repetir a validação do GS3 quando houver qualquer alteração compartilhada.

Especialmente preservar o comportamento já validado de:

- seleção explícita de Field;
- PointSelector;
- regra de 1e-7°;
- CoordinateTransformer;
- FDShape P1–P5;
- SpatialCatalog;
- WaterManagement;
- setup.fds;
- ZIP exporter.

---

## 15. Estado atual do conhecimento

### Client / Farm / Field

**CONFIRMADO**

A hierarquia existe nos dois projetos analisados e é representada por GUIDs.

### WorkDescriptor

**FORTE EVIDÊNCIA**

O normal possui 8 e o Golden possui 0.

A ausência no Golden é confirmada, mas a regra universal de remoção ainda não foi demonstrada por uma segunda referência.

### AdaptiveCurve

**CONFIRMADO**

Existem 5 no normal e 18 no Golden.

**DESCONHECIDO**

A correspondência geral e a origem das curvas adicionais.

### Operator

**CONFIRMADO**

O Golden possui 19 e o normal analisado não possui Operator.

**DESCONHECIDO**

Se Operators devem ser criados pelo transformador e de onde seus dados devem vir.

### ABCurve / ABLine / APoint / BPoint

**CONFIRMADO**

Aparecem no Golden e não no Gen4 normal fornecido.

**DESCONHECIDO**

Origem, obrigatoriedade e regra de criação.

### Flag

**CONFIRMADO**

Aparece no Golden e não no normal fornecido.

**DESCONHECIDO**

Origem e obrigatoriedade.

### OperationalBoundary

**CONFIRMADO**

Existe no Golden 600057 e possui representação espacial correspondente.

**DESCONHECIDO**

Se é requisito universal de Setup Work.

### RTKBaseStations

**CONFIRMADO**

Existem 12 no Golden e nenhuma no normal fornecido.

**DESCONHECIDO**

Origem e obrigatoriedade.

### SpatialFiles

**CONFIRMADO**

O conjunto muda de 5 para 25 arquivos GJSON no par analisado.

**DESCONHECIDO**

A regra genérica de materialização.

### Versionamento

**CONFIRMADO**

Os valores de FileSchemaContentVersion, UnitOfMeasureVersion e RepresentationSystemVersion mudam.

**DESCONHECIDO**

Como determinar os valores corretos para projetos futuros.

### Regra de ouro

**Não transformar FORTE EVIDÊNCIA em CONFIRMADO.**

**Não transformar DESCONHECIDO em regra por conveniência de implementação.**

---

## 16. Checklist operacional

### ANTES DE CODIFICAR

- [ ] evidência localizada;
- [ ] fonte registrada;
- [ ] classificação definida;
- [ ] entidade de origem identificada;
- [ ] entidade de destino identificada;
- [ ] dependências identificadas;
- [ ] relação por GUID verificada;
- [ ] regra não depende de 600057;
- [ ] regra não depende de primeiro elemento;
- [ ] regra não depende de nome isolado;
- [ ] regra não depende de timestamp;
- [ ] regra não depende de SourceNode isoladamente;
- [ ] teste planejado;
- [ ] impacto no Gen4 → GS3 avaliado.

### DURANTE

- [ ] builder Setup Work isolado;
- [ ] parser neutro preservado quando possível;
- [ ] GS3 intacto;
- [ ] sem hard-code de GUIDs do Golden;
- [ ] sem cópia cega do Golden;
- [ ] somente entidades com regra comprovada transformadas;
- [ ] testes novos limitados ao comportamento implementado;
- [ ] nenhuma refatoração não relacionada.

### DEPOIS

- [ ] `npm.cmd test -- --run` passa;
- [ ] `npm.cmd run build` passa;
- [ ] ZIP real validado quando aplicável;
- [ ] estrutura do ZIP revisada;
- [ ] referências por GUID verificadas;
- [ ] Golden Reference comparado quando aplicável;
- [ ] diff revisado;
- [ ] `git status` revisado;
- [ ] branch correta: `feature/gen4-setup-work`;
- [ ] somente arquivos relacionados preparados para commit;
- [ ] commit descritivo;
- [ ] push somente após revisão.

---

## Regra final

Esta SKILL existe para impedir que uma diferença observada em um único Golden Reference seja transformada prematuramente em algoritmo.

Quando a evidência for suficiente: **implementar a menor regra rastreável**.

Quando houver apenas forte evidência: **investigar ou documentar a limitação**.

Quando houver hipótese: **testar antes de implementar**.

Quando for desconhecido: **não inventar**.

O objetivo é produzir um Gen4 Setup Work reproduzível, rastreável e baseado em evidência, preservando integralmente o fluxo Gen4 → GS3 já validado.
