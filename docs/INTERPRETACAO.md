# Camada de interpretação: leitura automática por município

Documenta a geração da leitura interpretativa do painel: um relatório consolidado por município (como está, o que se destaca, caminhos fiscais possíveis) e uma fatia curta por tela, produzidos por modelo de linguagem local em lote. A pergunta que esta camada responde é direta: o que o usuário lê está sendo interpretado corretamente, e sem viés. O artefato resultante é `dados/interpretacoes.json`, lido de forma estática. Complementa [IDM_SPEC.md](IDM_SPEC.md) (índice), [DADOS.md](DADOS.md) (fontes) e [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md) (postura descritiva).

## Princípio: o modelo redige, o procedimento raciocina

Modelos locais pequenos, ao receberem números crus, tendem a três erros: inverter a direção de uma comparação, inflar a intensidade que os dados não têm, e expandir siglas de forma incorreta. Por isso o desenho separa raciocínio de redação. O raciocínio é feito antes, de forma determinística; o modelo recebe fatos já resolvidos e apenas os transforma em prosa. Cada saída passa por um portão que reprova o que fugir dos fatos.

Três travas garantem que o modelo não se perca:

- **Registro compacto por município.** O modelo nunca lê a base inteira. Recebe um município por vez, com o contexto comparativo já calculado frente à mediana do próprio porte, nunca frente à média nacional, num bloco pequeno e autocontido.
- **Decodificação guiada por esquema.** A saída é forçada ao esquema JSON, sem texto livre fora dos campos.
- **Portão de validação.** Cada saída é conferida contra o próprio registro antes de publicar; o que não passa é re-tentado e, persistindo, marcado como sem leitura, sem entrar no artefato.

## O que é pré-computado

Para cada município, de forma determinística, antes de acionar o modelo:

- **Nível de dependência** (baixo, médio, alto) a partir do posto percentílico do IDM, entregue pronto, para o modelo não inferir intensidade.
- **Comparação fiscal por porte com direção já resolvida**: participação do FPM na receita ante a mediana do porte, e razão receita sobre PIB ante a mediana do porte, cada uma com a palavra de direção correta.
- **Serviços por extenso** (saúde de alta complexidade; instituição de ensino superior), para evitar expansão errada de sigla.
- **Órbita**: para orbitante, o polo de destino e a distância; para polo, quantos municípios polariza.
- **Caminhos fiscais candidatos**, por regra: quando a arrecadação própria ante o PIB está abaixo do porte, aponta base própria a explorar; quando o FPM supera a mediana do porte, descreve a maior dependência de transferência; quando há ausência de serviço, descreve o consumo fora do município. São descrições de lacuna frente ao porte, nunca prescrição nem juízo.
- **Destaque estrutural**: a maior divergência relativa frente à mediana do porte.

## O que o modelo gera e o que é templado

O modelo compõe apenas os campos de prosa: `como_esta`, `problema`, `rede`, `para_o_gestor` e as fatias de tela `mapa`, `perfil` e `fiscal`. A fatia `ranking` é formulaica e por isso é gerada por template determinístico, sem modelo, com risco zero. O campo `rede` é obrigatório (de quem o município depende e se o polo resolve a lacuna, ou se a demanda sobe a rede; para polo, o tamanho da rede que sustenta), para que essa relação nunca seja colapsada numa síntese genérica. O campo `para_o_gestor` é habilitação, não prescrição: mostra onde o gestor pode olhar frente ao porte, sem ordem à prefeitura.

## Camada de número: dicionário de símbolos

Todo valor exibível (número, porcentagem, distância, população, nome de cidade) é um SÍMBOLO textual entre chaves. O modelo emite apenas o símbolo; a substituição pelo valor canônico é mecânica. Assim o valor, o rótulo e o formato nunca são responsabilidade do modelo, o que elimina alucinação de número, rótulo trocado e formato divergente. Os símbolos confundíveis são autorrotulados (`{IDM}` expande para "IDM 0,45", `{IDHM}` para "IDHM 0,65"), de modo que o modelo não consegue escrever "IDM 0,65". O portão audita a saída antes da substituição: dígito escrito fora de símbolo ou símbolo inventado reprova o registro.

## Portão de validação

O portão reprova a saída quando encontra: termo de juízo de gestão; vocabulário de causa; termo inválido ou sigla expandida errada; número que não consta do registro; leitura de direção incoerente com o percentil ou com a comparação de FPM; adjetivo de intensidade acima do nível dado; ou fatia de tela fora dos limites de tamanho. Nenhuma dessas violações entra no artefato.

## Enquadramento sem viés

A linguagem é travada como descritiva e estrutural. É proibido julgar a gestão (bom, ruim, eficiente) e afirmar causa (porque, leva a, resulta em). A comparação é sempre contra o mesmo porte, o mesmo enquadramento não moral do eixo fiscal de [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md). O relatório é único por município e reaproveitado em todas as telas, de modo que a leitura de cada tela é um recorte do mesmo relatório, sem interpretações divergentes entre telas.

## Modelo e runtime

- **Modelo**: `google/gemma-4-E2B-it` (Gemma 4 E2B), baixado do Hugging Face (modelo com aceite de licença exigido). A calibração usou o mesmo modelo via Ollama (`gemma4:e2b-it-qat`, quantização QAT int4 indistinguível do original por teste pareado); o lote usa vLLM pela vazão.
- **Runtime do lote**: vLLM 0.24.0 com continuous batching, cerca de 27 vezes a vazão de um runtime de slot único. MTP e continuous batching otimizam coisas opostas: MTP acelera fluxo único e não rende no lote, por isso o modelo pequeno em lote é o caminho de vazão máxima.

## Como o artefato é gerado

O lote roda localmente, sobre um servidor de modelo compatível com a API OpenAI, sem serviço externo e sem custo por chamada. Para cada município monta-se o registro compacto, chama-se o modelo com decodificação guiada por esquema, aplica-se o portão e, só então, substituem-se os símbolos pelos valores canônicos. O que reprova no portão é re-tentado; persistindo, o município fica sem leitura e não entra no artefato.

A conferência de qualidade não depende de rodar o lote: `dados/interpretacoes.json` publica o modelo usado, a data de geração, o total de registros e quantos ficaram sem leitura. Na versão publicada, 5.513 registros e **zero** sem leitura. Como o portão proíbe dígito fora de símbolo, nenhum número do painel vem do modelo, e a auditoria do artefato se resume a ler o texto e confrontá-lo com os campos do município em `dados/municipios.json`.

## Idempotência

Cada registro do artefato carrega um `hash` dos campos-fonte que o alimentam. Numa nova rodada, o município cujo hash não mudou é reaproveitado do artefato anterior; só o que mudou é regerado. Assim um ajuste no painel não obriga a reprocessar os 5513 municípios.

## Exibição na interface

Toda leitura exibida ao usuário carrega uma nota explícita de que o texto é gerado automaticamente pelo modelo `google/gemma-4-E2B-it`, para que o leitor nunca confunda a leitura automática com afirmação editorial do painel. A tela de metodologia esclarece o procedimento aplicado: a mediação determinística, o papel do modelo como redator, o portão de validação e o enquadramento descritivo sem juízo nem causa. A leitura não é colorida no mapa nem misturada ao quadro de citação de terceiros de [DECISAO_CAUSAL.md](DECISAO_CAUSAL.md); vive em bloco próprio, rotulado como geração automática.

## Artefato: interpretacoes.json

Estrutura em [CONTRATO_DADO.md](CONTRATO_DADO.md). Objeto raiz com `modelo`, `gerado_em`, `n`, `sem_leitura` e a lista `municipios`, um registro por município com `codigo_ibge`, `como_esta`, `problema`, `rede`, `para_o_gestor`, `telas` (mapa, perfil, fiscal, ranking) e `hash`. Caso algum município não obtivesse leitura aprovada, o registro traria `sem_leitura: true` e apenas a fatia `ranking` templada; na versão publicada isso não ocorre em nenhum município.
