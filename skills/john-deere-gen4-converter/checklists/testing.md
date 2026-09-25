# Checklist — Testes

## Testes automatizados

Executar:

```
npm.cmd test -- --run
```

Confirmar:

- [ ] quantidade total;
- [ ] testes passando;
- [ ] testes falhando;
- [ ] mensagem completa de erro;
- [ ] causa provável;
- [ ] nenhum teste foi alterado apenas para mascarar uma falha.

## Build

Executar:

```
npm.cmd run build
```

Confirmar:

- [ ] sucesso;
- [ ] erros separados de warnings;
- [ ] warnings não tratados como falha automaticamente.

## Teste real

Quando a mudança produzir ou modificar um arquivo Gen4/GS3:

- [ ] usar arquivo real aplicável;
- [ ] executar conversão real;
- [ ] inspecionar estrutura do ZIP;
- [ ] verificar GUIDs e relações;
- [ ] comparar com Golden Reference quando existir;
- [ ] executar comparação byte-a-byte somente quando a entidade tiver equivalência comprovada.

## Integridade

- [ ] PointSelector não alterado sem escopo explícito.
- [ ] regra 1e-7° preservada.
- [ ] CoordinateTransformer preservado.
- [ ] FDShape encoder preservado.
- [ ] fluxo GS3 não alterado por trabalho Setup Work.
