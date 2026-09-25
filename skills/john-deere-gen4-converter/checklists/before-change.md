# Checklist — Antes de alterar código

- [ ] Confirmar branch atual.
- [ ] Confirmar que `main` não será alterada.
- [ ] Confirmar que `fix/explicit-field-selection` não será alterada quando o trabalho for Setup Work.
- [ ] Definir claramente o escopo da mudança.
- [ ] Identificar arquivos reais de origem e Golden Reference.
- [ ] Procurar relações por GUID antes de usar nomes.
- [ ] Classificar cada conclusão como CONFIRMADO, FORTE EVIDÊNCIA, HIPÓTESE ou DESCONHECIDO.
- [ ] Verificar se já existe infraestrutura no código antes de criar outra.
- [ ] Não usar primeiro elemento, nome isolado, timestamp, geometria ou SourceNode isoladamente como heurística.
- [ ] Não copiar GUIDs específicos do 600057 como regra.
- [ ] Confirmar quais arquivos são permitidos para alteração.
- [ ] Preservar o fluxo Gen4 → GS3 validado.
- [ ] Registrar o plano mínimo antes da implementação.
- [ ] Evitar refatorações não relacionadas.
