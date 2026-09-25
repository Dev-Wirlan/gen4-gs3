# Checklist — Release

## Estado

```
git status
git log --oneline -n 10
```

- [ ] branch correta;
- [ ] nenhuma alteração inesperada;
- [ ] nenhum arquivo temporário;
- [ ] nenhum ZIP de referência incluído;
- [ ] nenhum `playwright-report`;
- [ ] nenhum `test-results`.

## Revisão

```
git diff
```

- [ ] somente arquivos relacionados;
- [ ] nenhuma alteração funcional não planejada;
- [ ] nenhuma refatoração incidental.

## Commit

Adicionar somente arquivos específicos:

```
git add <arquivo1> <arquivo2> ...
git commit -m "<mensagem>"
```

- [ ] mensagem descreve somente o escopo;
- [ ] commit não contém código funcional não relacionado.

## Push

```
git push origin <branch>
```

- [ ] branch correta;
- [ ] não fazer merge em `main` sem autorização;
- [ ] confirmar SHA publicado;
- [ ] confirmar arquivos incluídos no commit.
