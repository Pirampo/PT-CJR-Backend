As correções de segurança da integração mantêm os frameworks e os scripts existentes. As atualizações diretas são de desenvolvimento: Vitest e coverage-v8 4.1.12. Nest CLI 12.0.8 e Schematics 12.0.6 foram preservados. O lockfile inclui fast-uri 3.1.9 e os transitivos compatíveis dessas ferramentas. O override limitado ao Nest CLI usa minimatch 11.0.5, a mesma versão adotada pelo CLI 12.0.13 para corrigir amplificação de padrões. A troca preserva a API usada pelo CLI e aceita Node 20 ou >=22, dentro dos requisitos existentes do projeto.

O Mau 0.2.8 fixa versões antigas de Inquirer e Undici. Além do override do CLI, os overrides do `package.json` ficam limitados ao Mau:

- Inquirer 8.2.7 preserva a API 8 e substitui a cadeia do editor que dependia do `tmp` vulnerável.
- Undici 6.29.1 preserva a API 6 e contém as correções de segurança dessa linha.

Esses overrides podem ser removidos quando o Mau publicar dependências equivalentes corrigidas e essa atualização for validada. Não usar um downgrade do Mau como correção automática de auditoria. O script `deploy` foi preservado; os testes de compatibilidade usam apenas `--help`, prompts fictícios, editor temporário e HTTP local, sem executar deployments.

Para reproduzir a instalação e a análise: `npm ci --ignore-scripts`, `npm audit` e `npm audit --omit=dev`. O resultado da auditoria depende da base de avisos consultada na data da execução. Ausência de alertas não é garantia de ausência de vulnerabilidades.

A árvore ainda contém o peer opcional TypeScript 5 do tsconfck 3.1.6, transitivo de vite-tsconfig-paths 5.1.4, enquanto o compilador do projeto permanece TypeScript 6. A configuração Vitest utiliza o parser JSON padrão do plugin; `parseNative` não está habilitado e o plugin não delega a leitura ao compilador TypeScript. Os testes e builds precisam continuar validando essa configuração. `npm ls --all` ainda pode retornar ELSPROBLEMS por esse peer: o aviso não foi suprimido e a declaração do pacote não foi alterada.

Não há patch publicado de tsconfck com peer TypeScript 6 na consulta desta revisão. As alternativas para uma revisão futura são aguardar suporte do pacote ou avaliar a resolução nativa de aliases do Vite, preservando os aliases utilizados pela equipe. Nenhum downgrade do compilador, remoção do plugin ou troca de configuração de testes foi feito nesta correção.

A atualização integral do CLI para o patch mais novo foi avaliada e evitada porque seus prompts transitivos recentes excluem Node 20. As correções finais não exigem essa mudança de ambiente. Os cenários de compilação e geração com dry-run devem validar a compatibilidade do override de minimatch.
