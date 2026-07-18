# Como reproduzir e como conferir

Este pacote publica **o dado e o método**, não o código. A reprodutibilidade aqui
não depende de executar um script do autor: depende de a especificação ser
completa o bastante para uma reimplementação independente chegar aos mesmos
números, e de os artefatos publicados permitirem conferência direta contra a
fonte oficial.

São dois caminhos, e o segundo não exige programar nada.

| Caminho | Para quem | Onde |
|---------|-----------|------|
| **Reimplementar** o índice do zero, a partir das fontes | pesquisador, equipe técnica | [01-fontes.md](01-fontes.md) e [02-metodo.md](02-metodo.md) |
| **Conferir** o que foi publicado, sem reimplementar | avaliador, jornalista, gestor | [03-conferir.md](03-conferir.md) |

## O que sustenta a afirmação de reprodutibilidade

1. **Especificação formal fechada.** [docs/IDM_SPEC.md](../docs/IDM_SPEC.md) fixa
   as variáveis, a normalização por posto percentílico, a regra de empate, a
   composição, os pesos e o tratamento de faltante. Nenhum passo do cálculo
   depende de escolha não declarada.
2. **Fontes identificadas até o endereço.** [01-fontes.md](01-fontes.md) traz o
   órgão, o recorte, o endereço exato e a data de extração de cada base.
3. **Contrato de dado explícito.** [docs/CONTRATO_DADO.md](../docs/CONTRATO_DADO.md)
   define campo, tipo, unidade e regra de nulo de cada artefato em `dados/`.
4. **Saída publicada por inteiro.** Os artefatos em `dados/` são o resultado
   completo, não uma amostra: 5.513 municípios com os três eixos, o índice, o
   posto percentílico e as camadas de contexto.
5. **Validação publicada junto.** `dados/validacao.json` traz as medidas que
   sustentam as afirmações do painel, para serem checadas, não aceitas.
6. **Casos conferíveis à mão.** [03-conferir.md](03-conferir.md) lista fatos que
   se verificam direto na fonte oficial, sem confiar no autor.

## Convenção

Cada receita é autocontida: o que é preciso ter, o procedimento descrito em nível
de método, o resultado esperado e como saber que deu certo. Os números de
conferência são exatos, não aproximados: uma reimplementação correta bate com
eles.
