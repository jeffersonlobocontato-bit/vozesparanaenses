-- =====================================================================
-- Vozes Paranaenses — 067_automacao_399_cidades.sql
-- Base da automação das 399 cidades (ver docs/automacao-399-cidades.md):
--
--  1. `cidades` passa a ter os 399 municípios do PR (antes: 41). Sem isso,
--     notícia de cidade fora da lista caía na região do JORNAL que publicou
--     (ex.: Palotina noticiada por jornal de Curitiba ia pra Metropolitana).
--     Também ganha a FOTO GERAL da cidade, usada quando a foto da fonte não
--     passa no critério de crédito.
--  2. `fontes` ganha cidade-sede e abrangência (municipal/regional/estadual)
--     — a região da fonte só vale como fallback para fonte MUNICIPAL.
--  3. Campos do CRIVO EDITORIAL (tema/prioridade/formato) e da CRITICIDADE
--     (nível, motivos) em clusters e matérias.
--  4. Colunas por cidade ("Vozes {Cidade}") em formato blog: notas avulsas,
--     ordenadas por data, em `coluna_cidade_notas`.
--  5. `agente_criticidade`: ajustes editáveis do agente de risco sem deploy.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Enum do cluster: o código já tenta gravar 'rascunho_gerado' e cai
--    para 'descartado' quando o valor não existe — o que mistura pauta
--    escrita com pauta descartada nos relatórios. Agora o valor existe.
-- ---------------------------------------------------------------------
alter type cluster_status add value if not exists 'rascunho_gerado';

-- ---------------------------------------------------------------------
-- 1. Cidades: 399 municípios + foto geral
-- ---------------------------------------------------------------------
alter table public.cidades
  add column if not exists foto_geral_url text,
  add column if not exists foto_geral_credito text,
  add column if not exists ativa boolean not null default true;

with base(slug, nome, regiao_slug) as (values
  ('abatia', 'Abatiá', 'norte-pioneiro'),
  ('adrianopolis', 'Adrianópolis', 'metropolitana'),
  ('agudos-do-sul', 'Agudos do Sul', 'metropolitana'),
  ('almirante-tamandare', 'Almirante Tamandaré', 'metropolitana'),
  ('altamira-do-parana', 'Altamira do Paraná', 'centro-ocidental'),
  ('alto-parana', 'Alto Paraná', 'noroeste'),
  ('alto-paraiso', 'Alto Paraíso', 'noroeste'),
  ('alto-piquiri', 'Alto Piquiri', 'noroeste'),
  ('altonia', 'Altônia', 'noroeste'),
  ('alvorada-do-sul', 'Alvorada do Sul', 'norte-central'),
  ('amapora', 'Amaporã', 'noroeste'),
  ('ampere', 'Ampére', 'sudoeste'),
  ('anahy', 'Anahy', 'oeste'),
  ('andira', 'Andirá', 'norte-pioneiro'),
  ('antonina', 'Antonina', 'litoral'),
  ('antonio-olinto', 'Antônio Olinto', 'centro-sul'),
  ('apucarana', 'Apucarana', 'norte-central'),
  ('arapongas', 'Arapongas', 'norte-central'),
  ('arapoti', 'Arapoti', 'campos-gerais'),
  ('arapua', 'Arapuã', 'norte-central'),
  ('araruna', 'Araruna', 'centro-ocidental'),
  ('araucaria', 'Araucária', 'metropolitana'),
  ('ariranha-do-ivai', 'Ariranha do Ivaí', 'norte-central'),
  ('assai', 'Assaí', 'norte-pioneiro'),
  ('assis-chateaubriand', 'Assis Chateaubriand', 'oeste'),
  ('astorga', 'Astorga', 'norte-central'),
  ('atalaia', 'Atalaia', 'norte-central'),
  ('balsa-nova', 'Balsa Nova', 'metropolitana'),
  ('bandeirantes', 'Bandeirantes', 'norte-pioneiro'),
  ('barbosa-ferraz', 'Barbosa Ferraz', 'centro-ocidental'),
  ('barra-do-jacare', 'Barra do Jacaré', 'norte-pioneiro'),
  ('barracao', 'Barracão', 'sudoeste'),
  ('bela-vista-da-caroba', 'Bela Vista da Caroba', 'sudoeste'),
  ('bela-vista-do-paraiso', 'Bela Vista do Paraíso', 'norte-central'),
  ('bituruna', 'Bituruna', 'centro-sul'),
  ('boa-esperanca', 'Boa Esperança', 'centro-ocidental'),
  ('boa-esperanca-do-iguacu', 'Boa Esperança do Iguaçu', 'sudoeste'),
  ('boa-ventura-de-sao-roque', 'Boa Ventura de São Roque', 'centro-sul'),
  ('boa-vista-da-aparecida', 'Boa Vista da Aparecida', 'oeste'),
  ('bocaiuva-do-sul', 'Bocaiúva do Sul', 'metropolitana'),
  ('bom-jesus-do-sul', 'Bom Jesus do Sul', 'sudoeste'),
  ('bom-sucesso', 'Bom Sucesso', 'norte-central'),
  ('bom-sucesso-do-sul', 'Bom Sucesso do Sul', 'sudoeste'),
  ('borrazopolis', 'Borrazópolis', 'norte-central'),
  ('braganey', 'Braganey', 'oeste'),
  ('brasilandia-do-sul', 'Brasilândia do Sul', 'noroeste'),
  ('cafeara', 'Cafeara', 'norte-central'),
  ('cafelandia', 'Cafelândia', 'oeste'),
  ('cafezal-do-sul', 'Cafezal do Sul', 'noroeste'),
  ('california', 'Califórnia', 'norte-central'),
  ('cambara', 'Cambará', 'norte-pioneiro'),
  ('cambira', 'Cambira', 'norte-central'),
  ('cambe', 'Cambé', 'norte-central'),
  ('campina-grande-do-sul', 'Campina Grande do Sul', 'metropolitana'),
  ('campina-da-lagoa', 'Campina da Lagoa', 'centro-ocidental'),
  ('campina-do-simao', 'Campina do Simão', 'centro-sul'),
  ('campo-bonito', 'Campo Bonito', 'oeste'),
  ('campo-largo', 'Campo Largo', 'metropolitana'),
  ('campo-magro', 'Campo Magro', 'metropolitana'),
  ('campo-mourao', 'Campo Mourão', 'centro-ocidental'),
  ('campo-do-tenente', 'Campo do Tenente', 'metropolitana'),
  ('candoi', 'Candói', 'centro-sul'),
  ('cantagalo', 'Cantagalo', 'centro-sul'),
  ('capanema', 'Capanema', 'sudoeste'),
  ('capitao-leonidas-marques', 'Capitão Leônidas Marques', 'oeste'),
  ('carambei', 'Carambeí', 'campos-gerais'),
  ('carlopolis', 'Carlópolis', 'norte-pioneiro'),
  ('cascavel', 'Cascavel', 'oeste'),
  ('castro', 'Castro', 'campos-gerais'),
  ('catanduvas', 'Catanduvas', 'oeste'),
  ('centenario-do-sul', 'Centenário do Sul', 'norte-central'),
  ('cerro-azul', 'Cerro Azul', 'metropolitana'),
  ('chopinzinho', 'Chopinzinho', 'sudoeste'),
  ('cianorte', 'Cianorte', 'noroeste'),
  ('cidade-gaucha', 'Cidade Gaúcha', 'noroeste'),
  ('clevelandia', 'Clevelândia', 'centro-sul'),
  ('colombo', 'Colombo', 'metropolitana'),
  ('colorado', 'Colorado', 'norte-central'),
  ('congonhinhas', 'Congonhinhas', 'norte-pioneiro'),
  ('conselheiro-mairinck', 'Conselheiro Mairinck', 'norte-pioneiro'),
  ('contenda', 'Contenda', 'metropolitana'),
  ('corbelia', 'Corbélia', 'oeste'),
  ('cornelio-procopio', 'Cornélio Procópio', 'norte-pioneiro'),
  ('coronel-domingos-soares', 'Coronel Domingos Soares', 'centro-sul'),
  ('coronel-vivida', 'Coronel Vivida', 'sudoeste'),
  ('corumbatai-do-sul', 'Corumbataí do Sul', 'centro-ocidental'),
  ('cruz-machado', 'Cruz Machado', 'centro-sul'),
  ('cruzeiro-do-iguacu', 'Cruzeiro do Iguaçu', 'sudoeste'),
  ('cruzeiro-do-oeste', 'Cruzeiro do Oeste', 'noroeste'),
  ('cruzeiro-do-sul', 'Cruzeiro do Sul', 'noroeste'),
  ('cruzmaltina', 'Cruzmaltina', 'norte-central'),
  ('curitiba', 'Curitiba', 'metropolitana'),
  ('curiuva', 'Curiúva', 'norte-pioneiro'),
  ('candido-de-abreu', 'Cândido de Abreu', 'norte-central'),
  ('ceu-azul', 'Céu Azul', 'oeste'),
  ('diamante-d-oeste', 'Diamante D''Oeste', 'oeste'),
  ('diamante-do-norte', 'Diamante do Norte', 'noroeste'),
  ('diamante-do-sul', 'Diamante do Sul', 'oeste'),
  ('dois-vizinhos', 'Dois Vizinhos', 'sudoeste'),
  ('douradina', 'Douradina', 'noroeste'),
  ('doutor-camargo', 'Doutor Camargo', 'norte-central'),
  ('doutor-ulysses', 'Doutor Ulysses', 'metropolitana'),
  ('engenheiro-beltrao', 'Engenheiro Beltrão', 'centro-ocidental'),
  ('entre-rios-do-oeste', 'Entre Rios do Oeste', 'oeste'),
  ('eneas-marques', 'Enéas Marques', 'sudoeste'),
  ('esperanca-nova', 'Esperança Nova', 'noroeste'),
  ('espigao-alto-do-iguacu', 'Espigão Alto do Iguaçu', 'centro-sul'),
  ('farol', 'Farol', 'centro-ocidental'),
  ('faxinal', 'Faxinal', 'norte-central'),
  ('fazenda-rio-grande', 'Fazenda Rio Grande', 'metropolitana'),
  ('fernandes-pinheiro', 'Fernandes Pinheiro', 'centro-sul'),
  ('figueira', 'Figueira', 'norte-pioneiro'),
  ('flor-da-serra-do-sul', 'Flor da Serra do Sul', 'sudoeste'),
  ('florai', 'Floraí', 'norte-central'),
  ('floresta', 'Floresta', 'norte-central'),
  ('florestopolis', 'Florestópolis', 'norte-central'),
  ('florida', 'Flórida', 'norte-central'),
  ('formosa-do-oeste', 'Formosa do Oeste', 'oeste'),
  ('foz-do-iguacu', 'Foz do Iguaçu', 'oeste'),
  ('foz-do-jordao', 'Foz do Jordão', 'centro-sul'),
  ('francisco-alves', 'Francisco Alves', 'noroeste'),
  ('francisco-beltrao', 'Francisco Beltrão', 'sudoeste'),
  ('fenix', 'Fênix', 'centro-ocidental'),
  ('general-carneiro', 'General Carneiro', 'centro-sul'),
  ('godoy-moreira', 'Godoy Moreira', 'norte-central'),
  ('goioere', 'Goioerê', 'centro-ocidental'),
  ('goioxim', 'Goioxim', 'centro-sul'),
  ('grandes-rios', 'Grandes Rios', 'norte-central'),
  ('guairaca', 'Guairaçá', 'noroeste'),
  ('guamiranga', 'Guamiranga', 'centro-sul'),
  ('guapirama', 'Guapirama', 'norte-pioneiro'),
  ('guaporema', 'Guaporema', 'noroeste'),
  ('guaraci', 'Guaraci', 'norte-central'),
  ('guaraniacu', 'Guaraniaçu', 'oeste'),
  ('guarapuava', 'Guarapuava', 'centro-sul'),
  ('guaraquecaba', 'Guaraqueçaba', 'litoral'),
  ('guaratuba', 'Guaratuba', 'litoral'),
  ('guaira', 'Guaíra', 'oeste'),
  ('honorio-serpa', 'Honório Serpa', 'centro-sul'),
  ('ibaiti', 'Ibaiti', 'norte-pioneiro'),
  ('ibema', 'Ibema', 'oeste'),
  ('ibipora', 'Ibiporã', 'norte-central'),
  ('icaraima', 'Icaraíma', 'noroeste'),
  ('iguaracu', 'Iguaraçu', 'norte-central'),
  ('iguatu', 'Iguatu', 'oeste'),
  ('imbau', 'Imbaú', 'campos-gerais'),
  ('imbituva', 'Imbituva', 'centro-sul'),
  ('inaja', 'Inajá', 'noroeste'),
  ('indianopolis', 'Indianópolis', 'noroeste'),
  ('inacio-martins', 'Inácio Martins', 'centro-sul'),
  ('ipiranga', 'Ipiranga', 'centro-sul'),
  ('ipora', 'Iporã', 'noroeste'),
  ('iracema-do-oeste', 'Iracema do Oeste', 'oeste'),
  ('irati', 'Irati', 'centro-sul'),
  ('iretama', 'Iretama', 'centro-ocidental'),
  ('itaguaje', 'Itaguajé', 'norte-central'),
  ('itaipulandia', 'Itaipulândia', 'oeste'),
  ('itambaraca', 'Itambaracá', 'norte-pioneiro'),
  ('itambe', 'Itambé', 'norte-central'),
  ('itapejara-d-oeste', 'Itapejara d''Oeste', 'sudoeste'),
  ('itaperucu', 'Itaperuçu', 'metropolitana'),
  ('itauna-do-sul', 'Itaúna do Sul', 'noroeste'),
  ('ivaipora', 'Ivaiporã', 'norte-central'),
  ('ivatuba', 'Ivatuba', 'norte-central'),
  ('ivate', 'Ivaté', 'noroeste'),
  ('ivai', 'Ivaí', 'centro-sul'),
  ('jaboti', 'Jaboti', 'norte-pioneiro'),
  ('jacarezinho', 'Jacarezinho', 'norte-pioneiro'),
  ('jaguapita', 'Jaguapitã', 'norte-central'),
  ('jaguariaiva', 'Jaguariaíva', 'campos-gerais'),
  ('jandaia-do-sul', 'Jandaia do Sul', 'norte-central'),
  ('janiopolis', 'Janiópolis', 'centro-ocidental'),
  ('japira', 'Japira', 'norte-pioneiro'),
  ('japura', 'Japurá', 'noroeste'),
  ('jardim-alegre', 'Jardim Alegre', 'norte-central'),
  ('jardim-olinda', 'Jardim Olinda', 'noroeste'),
  ('jataizinho', 'Jataizinho', 'norte-pioneiro'),
  ('jesuitas', 'Jesuítas', 'oeste'),
  ('joaquim-tavora', 'Joaquim Távora', 'norte-pioneiro'),
  ('jundiai-do-sul', 'Jundiaí do Sul', 'norte-pioneiro'),
  ('juranda', 'Juranda', 'centro-ocidental'),
  ('jussara', 'Jussara', 'noroeste'),
  ('kalore', 'Kaloré', 'norte-central'),
  ('lapa', 'Lapa', 'metropolitana'),
  ('laranjal', 'Laranjal', 'centro-sul'),
  ('laranjeiras-do-sul', 'Laranjeiras do Sul', 'centro-sul'),
  ('leopolis', 'Leópolis', 'norte-pioneiro'),
  ('lidianopolis', 'Lidianópolis', 'norte-central'),
  ('lindoeste', 'Lindoeste', 'oeste'),
  ('loanda', 'Loanda', 'noroeste'),
  ('lobato', 'Lobato', 'norte-central'),
  ('londrina', 'Londrina', 'norte-central'),
  ('luiziana', 'Luiziana', 'centro-ocidental'),
  ('lunardelli', 'Lunardelli', 'norte-central'),
  ('lupionopolis', 'Lupionópolis', 'norte-central'),
  ('mallet', 'Mallet', 'centro-sul'),
  ('mambore', 'Mamborê', 'centro-ocidental'),
  ('mandaguari', 'Mandaguari', 'norte-central'),
  ('mandaguacu', 'Mandaguaçu', 'norte-central'),
  ('mandirituba', 'Mandirituba', 'metropolitana'),
  ('manfrinopolis', 'Manfrinópolis', 'sudoeste'),
  ('mangueirinha', 'Mangueirinha', 'centro-sul'),
  ('manoel-ribas', 'Manoel Ribas', 'norte-central'),
  ('marechal-candido-rondon', 'Marechal Cândido Rondon', 'oeste'),
  ('maria-helena', 'Maria Helena', 'noroeste'),
  ('marialva', 'Marialva', 'norte-central'),
  ('marilena', 'Marilena', 'noroeste'),
  ('mariluz', 'Mariluz', 'noroeste'),
  ('marilandia-do-sul', 'Marilândia do Sul', 'norte-central'),
  ('maringa', 'Maringá', 'norte-central'),
  ('maripa', 'Maripá', 'oeste'),
  ('mariopolis', 'Mariópolis', 'sudoeste'),
  ('marmeleiro', 'Marmeleiro', 'sudoeste'),
  ('marquinho', 'Marquinho', 'centro-sul'),
  ('marumbi', 'Marumbi', 'norte-central'),
  ('matelandia', 'Matelândia', 'oeste'),
  ('matinhos', 'Matinhos', 'litoral'),
  ('mato-rico', 'Mato Rico', 'centro-sul'),
  ('maua-da-serra', 'Mauá da Serra', 'norte-central'),
  ('medianeira', 'Medianeira', 'oeste'),
  ('mercedes', 'Mercedes', 'oeste'),
  ('mirador', 'Mirador', 'noroeste'),
  ('miraselva', 'Miraselva', 'norte-central'),
  ('missal', 'Missal', 'oeste'),
  ('moreira-sales', 'Moreira Sales', 'centro-ocidental'),
  ('morretes', 'Morretes', 'litoral'),
  ('munhoz-de-melo', 'Munhoz de Melo', 'norte-central'),
  ('nossa-senhora-das-gracas', 'Nossa Senhora das Graças', 'norte-central'),
  ('nova-alianca-do-ivai', 'Nova Aliança do Ivaí', 'noroeste'),
  ('nova-america-da-colina', 'Nova América da Colina', 'norte-pioneiro'),
  ('nova-aurora', 'Nova Aurora', 'oeste'),
  ('nova-cantu', 'Nova Cantu', 'centro-ocidental'),
  ('nova-esperanca', 'Nova Esperança', 'norte-central'),
  ('nova-esperanca-do-sudoeste', 'Nova Esperança do Sudoeste', 'sudoeste'),
  ('nova-fatima', 'Nova Fátima', 'norte-pioneiro'),
  ('nova-laranjeiras', 'Nova Laranjeiras', 'centro-sul'),
  ('nova-londrina', 'Nova Londrina', 'noroeste'),
  ('nova-olimpia', 'Nova Olímpia', 'noroeste'),
  ('nova-prata-do-iguacu', 'Nova Prata do Iguaçu', 'sudoeste'),
  ('nova-santa-barbara', 'Nova Santa Bárbara', 'norte-pioneiro'),
  ('nova-santa-rosa', 'Nova Santa Rosa', 'oeste'),
  ('nova-tebas', 'Nova Tebas', 'norte-central'),
  ('novo-itacolomi', 'Novo Itacolomi', 'norte-central'),
  ('ortigueira', 'Ortigueira', 'campos-gerais'),
  ('ourizona', 'Ourizona', 'norte-central'),
  ('ouro-verde-do-oeste', 'Ouro Verde do Oeste', 'oeste'),
  ('paicandu', 'Paiçandu', 'norte-central'),
  ('palmas', 'Palmas', 'centro-sul'),
  ('palmeira', 'Palmeira', 'campos-gerais'),
  ('palmital', 'Palmital', 'centro-sul'),
  ('palotina', 'Palotina', 'oeste'),
  ('paranacity', 'Paranacity', 'noroeste'),
  ('paranagua', 'Paranaguá', 'litoral'),
  ('paranapoema', 'Paranapoema', 'noroeste'),
  ('paranavai', 'Paranavaí', 'noroeste'),
  ('paraiso-do-norte', 'Paraíso do Norte', 'noroeste'),
  ('pato-bragado', 'Pato Bragado', 'oeste'),
  ('pato-branco', 'Pato Branco', 'sudoeste'),
  ('paula-freitas', 'Paula Freitas', 'centro-sul'),
  ('paulo-frontin', 'Paulo Frontin', 'centro-sul'),
  ('peabiru', 'Peabiru', 'centro-ocidental'),
  ('perobal', 'Perobal', 'noroeste'),
  ('pinhais', 'Pinhais', 'metropolitana'),
  ('pinhal-de-sao-bento', 'Pinhal de São Bento', 'sudoeste'),
  ('pinhalao', 'Pinhalão', 'norte-pioneiro'),
  ('pinhao', 'Pinhão', 'centro-sul'),
  ('piraquara', 'Piraquara', 'metropolitana'),
  ('pirai-do-sul', 'Piraí do Sul', 'campos-gerais'),
  ('pitanga', 'Pitanga', 'centro-sul'),
  ('pitangueiras', 'Pitangueiras', 'norte-central'),
  ('pien', 'Piên', 'metropolitana'),
  ('planaltina-do-parana', 'Planaltina do Paraná', 'noroeste'),
  ('planalto', 'Planalto', 'sudoeste'),
  ('ponta-grossa', 'Ponta Grossa', 'campos-gerais'),
  ('pontal-do-parana', 'Pontal do Paraná', 'litoral'),
  ('porecatu', 'Porecatu', 'norte-central'),
  ('porto-amazonas', 'Porto Amazonas', 'metropolitana'),
  ('porto-barreiro', 'Porto Barreiro', 'centro-sul'),
  ('porto-rico', 'Porto Rico', 'noroeste'),
  ('porto-vitoria', 'Porto Vitória', 'centro-sul'),
  ('prado-ferreira', 'Prado Ferreira', 'norte-central'),
  ('pranchita', 'Pranchita', 'sudoeste'),
  ('presidente-castelo-branco', 'Presidente Castelo Branco', 'norte-central'),
  ('primeiro-de-maio', 'Primeiro de Maio', 'norte-central'),
  ('prudentopolis', 'Prudentópolis', 'centro-sul'),
  ('perola', 'Pérola', 'noroeste'),
  ('perola-d-oeste', 'Pérola d''Oeste', 'sudoeste'),
  ('quarto-centenario', 'Quarto Centenário', 'centro-ocidental'),
  ('quatigua', 'Quatiguá', 'norte-pioneiro'),
  ('quatro-barras', 'Quatro Barras', 'metropolitana'),
  ('quatro-pontes', 'Quatro Pontes', 'oeste'),
  ('quedas-do-iguacu', 'Quedas do Iguaçu', 'centro-sul'),
  ('querencia-do-norte', 'Querência do Norte', 'noroeste'),
  ('quinta-do-sol', 'Quinta do Sol', 'centro-ocidental'),
  ('quitandinha', 'Quitandinha', 'metropolitana'),
  ('ramilandia', 'Ramilândia', 'oeste'),
  ('rancho-alegre', 'Rancho Alegre', 'norte-pioneiro'),
  ('rancho-alegre-d-oeste', 'Rancho Alegre D''Oeste', 'centro-ocidental'),
  ('realeza', 'Realeza', 'sudoeste'),
  ('reboucas', 'Rebouças', 'centro-sul'),
  ('renascenca', 'Renascença', 'sudoeste'),
  ('reserva', 'Reserva', 'campos-gerais'),
  ('reserva-do-iguacu', 'Reserva do Iguaçu', 'centro-sul'),
  ('ribeirao-claro', 'Ribeirão Claro', 'norte-pioneiro'),
  ('ribeirao-do-pinhal', 'Ribeirão do Pinhal', 'norte-pioneiro'),
  ('rio-azul', 'Rio Azul', 'centro-sul'),
  ('rio-bom', 'Rio Bom', 'norte-central'),
  ('rio-bonito-do-iguacu', 'Rio Bonito do Iguaçu', 'centro-sul'),
  ('rio-branco-do-ivai', 'Rio Branco do Ivaí', 'norte-central'),
  ('rio-branco-do-sul', 'Rio Branco do Sul', 'metropolitana'),
  ('rio-negro', 'Rio Negro', 'metropolitana'),
  ('rolandia', 'Rolândia', 'norte-central'),
  ('roncador', 'Roncador', 'centro-ocidental'),
  ('rondon', 'Rondon', 'noroeste'),
  ('rosario-do-ivai', 'Rosário do Ivaí', 'norte-central'),
  ('sabaudia', 'Sabáudia', 'norte-central'),
  ('salgado-filho', 'Salgado Filho', 'sudoeste'),
  ('salto-do-itarare', 'Salto do Itararé', 'norte-pioneiro'),
  ('salto-do-lontra', 'Salto do Lontra', 'sudoeste'),
  ('santa-amelia', 'Santa Amélia', 'norte-pioneiro'),
  ('santa-cecilia-do-pavao', 'Santa Cecília do Pavão', 'norte-pioneiro'),
  ('santa-cruz-de-monte-castelo', 'Santa Cruz de Monte Castelo', 'noroeste'),
  ('santa-fe', 'Santa Fé', 'norte-central'),
  ('santa-helena', 'Santa Helena', 'oeste'),
  ('santa-ines', 'Santa Inês', 'norte-central'),
  ('santa-isabel-do-ivai', 'Santa Isabel do Ivaí', 'noroeste'),
  ('santa-izabel-do-oeste', 'Santa Izabel do Oeste', 'sudoeste'),
  ('santa-lucia', 'Santa Lúcia', 'oeste'),
  ('santa-maria-do-oeste', 'Santa Maria do Oeste', 'centro-sul'),
  ('santa-mariana', 'Santa Mariana', 'norte-pioneiro'),
  ('santa-monica', 'Santa Mônica', 'noroeste'),
  ('santa-tereza-do-oeste', 'Santa Tereza do Oeste', 'oeste'),
  ('santa-terezinha-de-itaipu', 'Santa Terezinha de Itaipu', 'oeste'),
  ('santana-do-itarare', 'Santana do Itararé', 'norte-pioneiro'),
  ('santo-antonio-da-platina', 'Santo Antônio da Platina', 'norte-pioneiro'),
  ('santo-antonio-do-caiua', 'Santo Antônio do Caiuá', 'noroeste'),
  ('santo-antonio-do-paraiso', 'Santo Antônio do Paraíso', 'norte-pioneiro'),
  ('santo-antonio-do-sudoeste', 'Santo Antônio do Sudoeste', 'sudoeste'),
  ('santo-inacio', 'Santo Inácio', 'norte-central'),
  ('sapopema', 'Sapopema', 'norte-pioneiro'),
  ('sarandi', 'Sarandi', 'norte-central'),
  ('saudade-do-iguacu', 'Saudade do Iguaçu', 'sudoeste'),
  ('senges', 'Sengés', 'campos-gerais'),
  ('serranopolis-do-iguacu', 'Serranópolis do Iguaçu', 'oeste'),
  ('sertaneja', 'Sertaneja', 'norte-pioneiro'),
  ('sertanopolis', 'Sertanópolis', 'norte-central'),
  ('siqueira-campos', 'Siqueira Campos', 'norte-pioneiro'),
  ('sulina', 'Sulina', 'sudoeste'),
  ('sao-carlos-do-ivai', 'São Carlos do Ivaí', 'noroeste'),
  ('sao-jeronimo-da-serra', 'São Jerônimo da Serra', 'norte-pioneiro'),
  ('sao-jorge-d-oeste', 'São Jorge d''Oeste', 'sudoeste'),
  ('sao-jorge-do-ivai', 'São Jorge do Ivaí', 'norte-central'),
  ('sao-jorge-do-patrocinio', 'São Jorge do Patrocínio', 'noroeste'),
  ('sao-jose-da-boa-vista', 'São José da Boa Vista', 'norte-pioneiro'),
  ('sao-jose-das-palmeiras', 'São José das Palmeiras', 'oeste'),
  ('sao-jose-dos-pinhais', 'São José dos Pinhais', 'metropolitana'),
  ('sao-joao', 'São João', 'sudoeste'),
  ('sao-joao-do-caiua', 'São João do Caiuá', 'noroeste'),
  ('sao-joao-do-ivai', 'São João do Ivaí', 'norte-central'),
  ('sao-joao-do-triunfo', 'São João do Triunfo', 'centro-sul'),
  ('sao-manoel-do-parana', 'São Manoel do Paraná', 'noroeste'),
  ('sao-mateus-do-sul', 'São Mateus do Sul', 'centro-sul'),
  ('sao-miguel-do-iguacu', 'São Miguel do Iguaçu', 'oeste'),
  ('sao-pedro-do-iguacu', 'São Pedro do Iguaçu', 'oeste'),
  ('sao-pedro-do-ivai', 'São Pedro do Ivaí', 'norte-central'),
  ('sao-pedro-do-parana', 'São Pedro do Paraná', 'noroeste'),
  ('sao-sebastiao-da-amoreira', 'São Sebastião da Amoreira', 'norte-pioneiro'),
  ('sao-tome', 'São Tomé', 'noroeste'),
  ('tamarana', 'Tamarana', 'norte-central'),
  ('tamboara', 'Tamboara', 'noroeste'),
  ('tapejara', 'Tapejara', 'noroeste'),
  ('tapira', 'Tapira', 'noroeste'),
  ('teixeira-soares', 'Teixeira Soares', 'centro-sul'),
  ('telemaco-borba', 'Telêmaco Borba', 'campos-gerais'),
  ('terra-boa', 'Terra Boa', 'centro-ocidental'),
  ('terra-rica', 'Terra Rica', 'noroeste'),
  ('terra-roxa', 'Terra Roxa', 'oeste'),
  ('tibagi', 'Tibagi', 'campos-gerais'),
  ('tijucas-do-sul', 'Tijucas do Sul', 'metropolitana'),
  ('toledo', 'Toledo', 'oeste'),
  ('tomazina', 'Tomazina', 'norte-pioneiro'),
  ('tres-barras-do-parana', 'Três Barras do Paraná', 'oeste'),
  ('tunas-do-parana', 'Tunas do Paraná', 'metropolitana'),
  ('tuneiras-do-oeste', 'Tuneiras do Oeste', 'noroeste'),
  ('tupassi', 'Tupãssi', 'oeste'),
  ('turvo', 'Turvo', 'centro-sul'),
  ('ubirata', 'Ubiratã', 'centro-ocidental'),
  ('umuarama', 'Umuarama', 'noroeste'),
  ('uniflor', 'Uniflor', 'norte-central'),
  ('uniao-da-vitoria', 'União da Vitória', 'centro-sul'),
  ('urai', 'Uraí', 'norte-pioneiro'),
  ('ventania', 'Ventania', 'campos-gerais'),
  ('vera-cruz-do-oeste', 'Vera Cruz do Oeste', 'oeste'),
  ('vere', 'Verê', 'sudoeste'),
  ('virmond', 'Virmond', 'centro-sul'),
  ('vitorino', 'Vitorino', 'sudoeste'),
  ('wenceslau-braz', 'Wenceslau Braz', 'norte-pioneiro'),
  ('xambre', 'Xambrê', 'noroeste'),
  ('angulo', 'Ângulo', 'norte-central')
)
insert into public.cidades (slug, nome, regiao_id)
select b.slug, b.nome, r.id
from base b
join public.regioes r on r.slug = b.regiao_slug
on conflict (slug) do update
  set nome = excluded.nome,
      regiao_id = excluded.regiao_id;

-- ---------------------------------------------------------------------
-- 2. Fontes: cidade-sede e abrangência
-- ---------------------------------------------------------------------
alter table public.fontes
  add column if not exists cidade_slug text references public.cidades(slug) on update cascade,
  add column if not exists abrangencia text not null default 'regional',
  add column if not exists ultimo_ciclo jsonb;

do $$ begin
  alter table public.fontes add constraint fontes_abrangencia_chk
    check (abrangencia in ('municipal', 'regional', 'estadual'));
exception when duplicate_object then null; end $$;

-- Prefeitura é, por definição, fonte municipal.
update public.fontes set abrangencia = 'municipal'
where tipo = 'prefeitura' and abrangencia = 'regional';

create index if not exists fontes_cidade_idx on public.fontes(cidade_slug);

-- ---------------------------------------------------------------------
-- 3. Coleta: status da foto e origem da data
-- ---------------------------------------------------------------------
alter table public.raw_articles
  add column if not exists foto_status text,
  add column if not exists data_origem text;

do $$ begin
  alter table public.raw_articles add constraint raw_articles_foto_status_chk
    check (foto_status is null or foto_status in ('autorizada', 'proibida', 'sem_credito', 'sem_foto'));
exception when duplicate_object then null; end $$;

create index if not exists raw_articles_coletado_idx on public.raw_articles(coletado_em desc);

-- ---------------------------------------------------------------------
-- 4. Crivo editorial no cluster
-- ---------------------------------------------------------------------
alter table public.article_clusters
  add column if not exists cidade_slug text,
  add column if not exists tema_crivo text,
  add column if not exists prioridade_crivo text,
  add column if not exists forcar_nota boolean not null default false;

-- ---------------------------------------------------------------------
-- 5. Matéria: formato, foto e criticidade
-- ---------------------------------------------------------------------
alter table public.generated_articles
  add column if not exists formato text not null default 'materia',
  add column if not exists tema_crivo text,
  add column if not exists prioridade_crivo text,
  add column if not exists foto_origem text,
  add column if not exists criticidade_nivel text,
  add column if not exists criticidade_score integer,
  add column if not exists criticidade_motivos jsonb not null default '[]'::jsonb,
  add column if not exists criticidade_avaliada_em timestamptz;

do $$ begin
  alter table public.generated_articles add constraint generated_articles_criticidade_chk
    check (criticidade_nivel is null or criticidade_nivel in ('baixo', 'medio', 'alto', 'critico'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 6. Colunas por cidade ("Vozes {Cidade}") — formato blog
-- ---------------------------------------------------------------------
alter table public.colunas
  add column if not exists tipo text not null default 'opiniao',
  add column if not exists cidade_slug text references public.cidades(slug) on update cascade;

create unique index if not exists colunas_cidade_unq
  on public.colunas(cidade_slug) where cidade_slug is not null;

create table if not exists public.coluna_cidade_notas (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid not null references public.colunas(id) on delete cascade,
  cidade_slug text not null references public.cidades(slug) on update cascade,
  regiao_id uuid references public.regioes(id),
  -- 1 cluster = no máximo 1 nota: trava de banco contra repetição.
  cluster_id uuid unique references public.article_clusters(id) on delete set null,
  titulo text not null,
  corpo text not null,
  fonte_nome text,
  fonte_url text,
  tema_crivo text,
  data_publicacao_original timestamptz,
  status text not null default 'revisao',
  criticidade_nivel text,
  criticidade_motivos jsonb not null default '[]'::jsonb,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint coluna_cidade_notas_status_chk check (status in ('revisao', 'publicado', 'rejeitado'))
);

create index if not exists coluna_cidade_notas_feed_idx
  on public.coluna_cidade_notas(cidade_slug, status, publicado_em desc);
create index if not exists coluna_cidade_notas_fila_idx
  on public.coluna_cidade_notas(status, criado_em desc);

alter table public.coluna_cidade_notas enable row level security;

drop policy if exists "notas cidade leitura publica" on public.coluna_cidade_notas;
create policy "notas cidade leitura publica" on public.coluna_cidade_notas
  for select to anon, authenticated using (status = 'publicado');

drop policy if exists "notas cidade equipe" on public.coluna_cidade_notas;
create policy "notas cidade equipe" on public.coluna_cidade_notas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- Cria (ou devolve) a coluna "Vozes {Cidade}" — chamada pelo pipeline.
create or replace function public.garantir_coluna_cidade(p_cidade_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text;
begin
  select id into v_id from public.colunas where cidade_slug = p_cidade_slug;
  if v_id is not null then return v_id; end if;

  select nome into v_nome from public.cidades where slug = p_cidade_slug;
  if v_nome is null then
    raise exception 'cidade_inexistente: %', p_cidade_slug;
  end if;

  insert into public.colunas (slug, nome, descricao, tipo, cidade_slug, ativo)
  values (
    'vozes-' || p_cidade_slug,
    'Vozes ' || v_nome,
    'As notas do dia de ' || v_nome || ', em ordem de publicação.',
    'cidade',
    p_cidade_slug,
    true
  )
  on conflict (slug) do update set cidade_slug = excluded.cidade_slug, tipo = 'cidade'
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.garantir_coluna_cidade(text) from public, anon, authenticated;
grant execute on function public.garantir_coluna_cidade(text) to service_role;

-- ---------------------------------------------------------------------
-- 7. Agente de criticidade (ajustes editáveis sem deploy)
-- ---------------------------------------------------------------------
create table if not exists public.agente_criticidade (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  ativo boolean not null default true,
  -- A partir de qual nível a matéria/nota vai para revisão humana.
  limiar_revisao text not null default 'medio',
  -- Texto livre somado ao prompt-base (ex.: "período eleitoral até 25/10").
  instrucoes_extra text,
  -- Termos que sempre forçam revisão (ex.: nome de pessoa em litígio com o portal).
  termos_bloqueio jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint agente_criticidade_limiar_chk check (limiar_revisao in ('baixo', 'medio', 'alto', 'critico'))
);

insert into public.agente_criticidade (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.agente_criticidade enable row level security;

drop policy if exists "agente criticidade equipe" on public.agente_criticidade;
create policy "agente criticidade equipe" on public.agente_criticidade
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- ---------------------------------------------------------------------
-- 8. "Nunca repetir": a pauta nova é o MESMO fato de algo que já virou
--    (ou está virando) matéria/nota nas últimas 72h? Compara o centróide
--    do cluster novo com os centróides dos clusters já selecionados.
--    Pega o caso prefeitura + jornal local, e o caso "a mesma notícia
--    republicada no dia seguinte com outra URL".
-- ---------------------------------------------------------------------
create or replace function public.cluster_duplicado(p_cluster_id uuid, p_limiar double precision default 0.86)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select outro.id
  from public.article_clusters novo
  join public.article_clusters outro
    on outro.id <> novo.id
   and outro.criado_em > now() - interval '72 hours'
   -- ::text: o valor 'rascunho_gerado' é criado nesta mesma migration
   and outro.status::text in ('selecionado_cota', 'fatos_extraidos', 'rascunho_gerado')
   and outro.embedding_centroide is not null
  where novo.id = p_cluster_id
    and novo.embedding_centroide is not null
    and 1 - (novo.embedding_centroide <=> outro.embedding_centroide) >= p_limiar
  order by novo.embedding_centroide <=> outro.embedding_centroide
  limit 1
$$;

revoke all on function public.cluster_duplicado(uuid, double precision) from public, anon, authenticated;
grant execute on function public.cluster_duplicado(uuid, double precision) to service_role;
