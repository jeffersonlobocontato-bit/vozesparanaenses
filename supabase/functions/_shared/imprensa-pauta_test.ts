import { clienteEhPrefeitura, interpretarAvaliacao, mensagemPautaBloqueada } from "./imprensa-pauta.ts";
function check(nome: string, cond: boolean) { if (!cond) throw new Error("FALHOU: " + nome); console.log("ok:", nome); }
check("json válido", interpretarAvaliacao('{"acao_prefeitura": false, "motivo": "É propaganda de loja."}')?.ok === false);
check("json em bloco", interpretarAvaliacao('```json\n{"acao_prefeitura": true, "motivo": "Obra municipal."}\n```')?.ok === true);
check("json sem campo vira null", interpretarAvaliacao('{"ok": true}') === null);
check("lixo vira null", interpretarAvaliacao("talvez") === null);
check("mensagem traz motivo", mensagemPautaBloqueada("É propaganda de loja.").includes("Motivo: É propaganda de loja."));
check("cliente com cidade", clienteEhPrefeitura({ cidade_id: "x", nome_empresa: "Fulano" }));
check("cliente PREFA TESTE", clienteEhPrefeitura({ nome_empresa: "PREFA TESTE" }));
check("cliente empresa", !clienteEhPrefeitura({ nome_empresa: "FIEP" }));
