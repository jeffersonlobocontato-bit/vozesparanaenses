-- Atualiza a seção "Quem somos" com a razão social e CNPJ do veículo.
update public.sobre_config
set quem_somos = 'O Vozes Paranaenses é um veículo da **AGÊNCIA DE INTELIGÊNCIA VOZES LTDA — CNPJ: 68.276.102/0001-78**.

O portal foi fundado por **Jefferson Lobo**, responsável editorial pelo projeto.',
    atualizado_em = now()
where singleton = true;
