# John Deere Gen4 Converter Skill

## Escopo

Esta skill organiza o trabalho de engenharia e investigação do projeto Gen4/GS3. O projeto possui dois fluxos que devem permanecer isolados:

- Gen4 → GS3: fluxo existente e validado.
- Gen4 normal → Gen4 Setup Work: fluxo futuro, em investigação nesta branch.

## Regras de evidência

Toda conclusão deve ser classificada como:

- **CONFIRMADO** — observado diretamente em arquivo real, código executado ou teste reproduzível.
- **FORTE EVIDÊNCIA** — sustentado por múltiplas observações, mas ainda não demonstrado como regra universal.
- **HIPÓTESE** — explicação plausível ainda não comprovada.
- **DESCONHECIDO** — não há evidência suficiente.

Nunca transformar uma hipótese antiga em fato. Se documentos entrarem em conflito, registrar o conflito e marcar o ponto como DESCONHECIDO até nova verificação.

## Golden Reference

Golden References são artefatos reais usados para comparação. Devem ser tratados como fonte de verdade do comportamento observado, não como fonte automática de regras universais.

Nunca copiar GUIDs, nomes, timestamps, SourceNode ou quantidades de um projeto Golden Reference como regra para outros projetos sem evidência de que representam estrutura do formato.

## Isolamento dos fluxos

O trabalho Gen4 → Gen4 Setup Work não deve alterar silenciosamente:

- seleção explícita de Field do fluxo GS3;
- PointSelector;
- regra de 1e-7°;
- CoordinateTransformer;
- FDShape encoder;
- SpatialCatalog GS3;
- WaterManagement GS3;
- ZIP exporter;
- UI do conversor GS3.

Qualquer mudança compartilhada deve ser justificada como necessária e validada contra os Golden References existentes.

## Protocolo de análise

1. Identificar os arquivos reais de origem e destino.
2. Extrair estrutura, GUIDs, nomes, atributos, filhos e relações.
3. Cruzar referências por GUID antes de interpretar nomes.
4. Separar estrutura comum, entidade específica e comportamento desconhecido.
5. Registrar evidência direta e limitações.
6. Não implementar enquanto a regra de transformação ainda depender de heurística não comprovada.

## Protocolo de implementação

1. Definir a menor alteração arquitetural compatível com as evidências.
2. Manter parser neutro quando a seleção não for determinada.
3. Não usar primeiro elemento, nome isolado, timestamp, geometria ou SourceNode isoladamente como seleção.
4. Preservar estruturas já validadas.
5. Alterar somente arquivos necessários.
6. Adicionar testes apenas para comportamento novo e comprovado.

## Protocolo de testes

Executar, conforme aplicável:

```
npm.cmd test -- --run
npm.cmd run build
```

Quando houver Golden Reference aplicável, realizar também uma conversão real e comparação estrutural/byte-a-byte das entidades que já possuem referência confiável.

## Protocolo de commit

Antes do commit:

```
git status
git diff
git log --oneline -n 10
```

Adicionar somente arquivos relacionados:

```
git add <arquivos-específicos>
git commit -m "<mensagem>"
```

Nunca incluir ZIPs, relatórios de Playwright, `test-results`, artefatos de build ou arquivos temporários.

## Branches

- `main`: não alterar durante investigação.
- `fix/explicit-field-selection`: fluxo GS3 validado; não alterar durante o desenvolvimento Setup Work.
- `feature/gen4-setup-work`: branch exclusiva do futuro fluxo Gen4 normal → Gen4 Setup Work.

Não criar outra branch sem solicitação explícita.

## Arquivos de investigação

Relatórios devem ficar em documentação e conter data/escopo, fontes utilizadas e classificação das conclusões. Não adicionar ZIPs, screenshots, `playwright-report` ou `test-results` à skill.

## Regra principal

**Não inventar formato.** Quando a evidência não determinar uma regra, parar no diagnóstico e marcar como DESCONHECIDO.
