# GS3 Format — conhecimento confirmado

## Escopo

Este documento registra o conhecimento já validado do fluxo Gen4 → GS3. O fluxo não deve ser alterado pelo trabalho Gen4 → Gen4 Setup Work.

## Seleção explícita de Field

O fluxo GS3 possui seleção explícita de Field.

O `fieldId` é o GUID real do Field selecionado e percorre a cadeia de conversão até a geração dos artefatos GS3.

No 600057, o contexto validado é:

- Client UL;
- Farm 600057;
- Field 600057;
- AdaptiveCurves P1–P5.

A associação Client → Farm → Field é resolvida por GUID.

## CurveTrack

AdaptiveCurves selecionadas são convertidas em CurveTracks.

Para o Golden Reference 600057, P1–P5 foram validadas byte-a-byte contra os CurveTracks correspondentes do GS3 Golden Reference.

Essa equivalência depende do pipeline geométrico já validado e não deve ser alterada por esta skill.

## fdShape

O pipeline existente inclui PointSelector, CoordinateTransformer e encoder de FDShape.

A regra de seleção de pontos com tolerância de 1e-7° foi validada no projeto e não deve ser modificada sem nova investigação específica.

## SpatialCatalog

O GS3 possui `ImportExport.SpatialCatalog`, que descreve entidades espaciais como CurveTracks e, quando implementado, Boundary.

Não misturar esse arquivo com `WaterManagement.SpatialCatalog`.

## WaterManagement

O GS3 gerado possui suporte a `WaterManagement.SpatialCatalog`, associado ao Field selecionado.

A estrutura observada no Golden Reference inclui `SpatialItems` com `eridFieldRef` apontando para o GUID do Field e sem entidades espaciais internas no caso 600057.

## setup.fds

`setup.fds` referencia o contexto selecionado e seus artefatos GS3. Alterações devem preservar as referências P1–P5 já validadas.

## host e global.ver

Esses arquivos fazem parte do pacote GS3 e possuem metadata própria. Diferenças de metadata observadas no Golden Reference, incluindo host, não devem ser tratadas como diferenças geométricas sem análise específica.

## Integridade

Não alterar como parte do Setup Work:

- PointSelector;
- regra 1e-7°;
- CoordinateTransformer;
- fdshape-encoder;
- seleção explícita de Field;
- SpatialCatalog builder;
- WaterManagement builder;
- ZIP exporter.
