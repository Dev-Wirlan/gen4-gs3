# Evolução do relacionamento Gen4 por GUID

## Objetivo
Corrigir a leitura do `MasterData.xml` para reproduzir os relacionamentos reais confirmados pelo GS5, preservando a interface e todo o processamento local.

## Implementação
- Normalizar GUIDs com ou sem chaves e sem diferença entre maiúsculas e minúsculas.
- Modelar e relacionar Cliente → Fazenda → Talhão pelos GUIDs do `MasterData.xml`, sem inferência por nomes.
- Ler cada objeto espacial diretamente do `MasterData.xml` e associá-lo ao talhão quando `SpatialObject.TaggedEntity` corresponder a `Field.StringGuid`.
- Classificar separadamente `AdaptiveCurve`, `ABLine`, `ABCurve`, `OperationalBoundary` e `Flag`, preservando GUID, nome e referência ao arquivo `.gjson` quando disponível.
- Manter objetos sem talhão correspondente na lista de órfãos e emitir avisos claros.
- Permitir selecionar um talhão na árvore; somente as AdaptiveCurve daquele talhão entrarão na exportação.
- Nomear a saída validada como `CurveTrack{GUID}.fdShape`, sem alterar o encoder binário existente.
- Exibir os novos totais de validação: talhões, AdaptiveCurve totais e associadas, ABLines, Boundaries, Flags e órfãos.
- Ajustar os rótulos e o relatório exportado para deixar explícito o escopo selecionado e o que continua pendente.

## Validação
- Criar testes focados em normalização e relacionamento por GUID/TaggedEntity, incluindo nomes duplicados e objetos órfãos.
- Validar análise, seleção de talhão e conteúdo/nomenclatura do ZIP exportado no navegador.
- Confirmar que a versão continua funcional em desktop e celular e sem erros de compilação.

## Fora desta etapa
Não gerar Boundary `.fdShape`/`.fdData`, não converter ABLine/ABCurve/Flags e não montar o projeto GS3 completo (`setup.fds`, `global.ver`, host ou catálogo integral).
