# RankTrash: conceito do produto

> PWA gamificado que incentiva o descarte correto de resíduos na Facens (campanha **Lixo Zero**).
> Documento vivo: serve de base para o relatório da UPX e para as decisões do grupo.

## 1. A ideia em uma frase

O aluno vai jogar algo fora, abre o app, **fotografa o resíduo na lixeira**, a **IA identifica o item e o material**, o **GPS confirma que ele está numa lixeira cadastrada** e ele **ganha pontos**. Todo mês, quem estiver no topo do ranking ganha prêmios.

## 2. Mudança em relação à proposta anterior

| Antes (1ª versão do relatório) | Agora |
|---|---|
| Lixeira automatizada (hardware) só para latinhas | **Só software**: PWA + IA, sem hardware |
| Contagem feita por sensores | Contagem feita por foto + IA + GPS |
| Custo de peças e montagem | Custo ≈ R$ 0 (planos gratuitos) + prêmios |
| Um tipo de resíduo | Todos os materiais da coleta seletiva |

O objetivo de **gerar dados** (quantidade, tipo, local e horário dos descartes) continua e fica até melhor: cada registro traz material, lixeira, horário e foto.

## 3. Fluxo principal

```
[Mapa] → toca DESCARTAR → câmera ao vivo + GPS acompanhando
   → tira a foto → ENVIAR
   → servidor: login → GPS/lixeira → limites → foto repetida? → IA (Gemini) → pontos
   → resultado: item, material, "vai na lixeira AMARELA", pontos + bônus
```

## 4. Telas

1. **Mapa (home):** mapa escuro do campus com as lixeiras como pins pixelados.
   * Verde = você já usou. Vermelho = **inexplorada** (bônus na 1ª visita), no estilo dos "unexplored sightings" do Spidey Tracker.
   * Banner "N LIXEIRAS INEXPLORADAS", mascote e radar para centralizar na sua posição.
   * Letreiro (ticker) com os últimos descartes do campus.
2. **Descartar (botão central):** câmera, HUD com lixeira/distância/precisão do GPS, escolha da lixeira quando houver mais de uma por perto, animação de "scanner" e tela de resultado.
3. **Ranking:** temporada do mês (com prêmios), **guerra de cursos** e últimos 7 dias. Pódio + sua posição.
4. **Perfil:** nível/XP (nunca zera), pontos do mês, streak, impacto (itens e kg estimados), conquistas e histórico com status (OK / REVISÃO / NEGADO).
5. **Admin:** cadastro de lixeiras (tocando no mapa ou "usar minha localização"), fila de revisão, auditoria do top 10 com fotos, prêmios e fechamento da temporada.
6. **Regras:** como jogar, tabela de pontos e regras de jogo limpo (transparência reduz fraude e reclamação).

## 5. O GPS dá conta?

**Dá, com limites que o app precisa tratar.**

* O GPS do celular erra de **5 a 15 m ao ar livre** e de **20 a 50 m ou mais dentro de prédios**. O navegador informa essa margem (`accuracy`).
* Em um PWA **não dá para detectar apps de GPS falso** (no Android existem vários).
* Duas lixeiras no mesmo corredor podem estar a poucos metros uma da outra.

**O que o app faz:**

1. **Regra de proximidade:** a distância até a lixeira precisa ser menor que `raio da lixeira + min(margem do GPS, 30 m)`. Leituras com margem acima de **60 m** são recusadas ("vá para um lugar mais aberto").
2. O app acompanha o GPS enquanto a câmera está aberta e usa **a leitura mais precisa dos últimos 15 s**.
3. Se houver várias lixeiras no raio, **o aluno escolhe qual** (chips na tela).
4. **A foto é a segunda prova:** a IA confirma que há um resíduo de verdade (e registra se aparece lixeira, só como dado de auditoria; não é obrigatório nem dá bônus).
5. **Auditoria humana** do top 10 antes da premiação.

**Plano B (se a fraude aparecer no piloto):** um adesivo com QR code em cada lixeira. O banco já tem o campo `bins.qr_code` reservado.

## 6. Pontuação

| Material | Pontos | Lixeira (CONAMA 275) |
|---|---|---|
| Alumínio (latas) | 10 | Amarela |
| Plástico | 8 | Vermelha |
| Vidro | 8 | Verde |
| Metal | 8 | Amarela |
| Papel/Papelão | 5 | Azul |
| Orgânico | 3 | Marrom |
| Eletrônico/Pilha | 15 | Laranja (ponto especial) |
| Não reciclável | 2 | Cinza |

**Bônus:** streak de 3+ dias ×1,2 · 1ª visita à lixeira +5 · 1º descarte do dia +3.
**Retorno decrescente:** o mesmo material no mesmo dia vale 100% nos 5 primeiros registros, 50% até o 10º e depois 0.
**Nível:** `floor(√(XP/10))` (nível 1 = 10 XP, nível 5 = 250 XP, nível 10 = 1000 XP).

Os valores ficam em `supabase/functions/_shared/scoring.ts` e `materials.ts`, e é fácil ajustá-los depois do piloto.

## 7. Antifraude: como evitar "o mesmo lixo várias vezes"

| Camada | Como funciona | Onde |
|---|---|---|
| Câmera ao vivo | Sem upload da galeria: a foto sai da câmera dentro do app | `src/lib/image.ts` |
| Hash perceptual (dHash 64 bits) | Foto com distância de Hamming ≤ 10 de outra foto sua dos últimos 30 dias → **recusada**. Parecida com a foto de outra pessoa nas últimas 24 h → **revisão** | `_shared/antifraud.ts` |
| Assinatura semântica | A IA descreve material + marca + cor + estado ("aluminio\|coca cola\|vermelha\|amassada"). Mesma assinatura na mesma lixeira em < 10 min → **recusada** | `_shared/antifraud.ts` |
| Foto de tela | A IA detecta foto de monitor/celular/impressa → **recusada** | prompt em `_shared/gemini.ts` |
| Limites | 1 registro/min · 20/dia · 8 por lixeira/dia | `_shared/antifraud.ts` |
| Confiança baixa | < 60% → **revisão** (os pontos só entram após aprovação) | Edge Function |
| Pontos só no servidor | O cliente não consegue gravar pontos nem mudar XP (RLS + permissões por coluna) | migration SQL |
| Auditoria | Admin vê as fotos do top 10 e pode **anular** registros antes de fechar o mês | tela Admin |

## 8. Gamificação: ideias para evoluir (roadmap)

* **Missões semanais:** "descarte 5 materiais diferentes", "visite 3 lixeiras novas".
* **Guerra de cursos** com troféu mensal para o curso campeão (a aba já existe).
* **Lixeira da semana:** uma lixeira sorteada vale pontos em dobro (espalha o uso pelo campus).
* **Eventos relâmpago:** "próxima 1 h: latinhas valem ×2" (na semana de provas, na calourada).
* **Card para compartilhar** no Instagram/X com o resultado, no estilo do "share your sightings" do Spidey Tracker.
* **Temporadas temáticas** (Semana do Meio Ambiente, Outubro Rosa etc.).
* **Parcerias com a cantina:** pontos viram desconto (precisa de acordo com a Facens).
* **Mascote evolutivo:** o Lixo-bot ganha acessórios conforme o nível.

## 9. Identidade visual

* **Referência:** Spidey Tracker (Samsung + Marvel): moldura de "console", mapa escuro, pixel art, botões creme/laranja e letreiro rolando.
* **Paleta:** azul royal (fundo), azul-claro (moldura), navy (tela), creme/laranja (botões), verde/vermelho (pins).
* **Fontes:** *Press Start 2P* (títulos) e *VT323* (texto), hospedadas no próprio app (funcionam offline).
* **Mascote:** "Lixo-bot", uma lixeira com lentes grandes. É **original**, feito em pixel art no código (`src/components/Mascot.tsx`), sem nenhum asset da Marvel/Samsung.
* **Sons 8-bit** gerados no próprio navegador, com botão para ligar/desligar.
* **Nome:** "RankTrash" é provisório. Outras opções para votar: *Trash Tracker*, *Caça-Lixo*, *Zero Hunter*, *Lixo-bot*.

## 10. Arquitetura

```
PWA (React + Vite + TypeScript)  ──►  Supabase Auth (conta Microsoft da Facens, só @facens.br)
        │                              Postgres + RLS (bins, disposals, profiles, seasons…)
        │                              Storage (bucket privado "disposals")
        └── foto + GPS ──►  Edge Function "register-disposal" (Deno)
                               ├─ login, geofence, limites
                               ├─ dHash e checagem de duplicatas
                               ├─ Gemini (saída JSON estruturada; chave fica só no servidor)
                               ├─ pontuação
                               └─ grava o descarte e atualiza o perfil
Hospedagem do PWA: Vercel (ou qualquer host estático)
```

* **Por que a chave do Gemini fica no servidor:** se ela estivesse no app, qualquer pessoa poderia copiá-la e esgotar a cota.
* **Cota gratuita do Gemini:** tem limite de requisições por minuto e por dia. Para um piloto no campus é suficiente, e o limite de 20 registros/dia por aluno protege a cota.
* **Modo demo:** sem backend configurado, o app roda com dados simulados. Serve para apresentar na banca e desenvolver as telas.

## 11. LGPD e privacidade

* Login só com a conta Microsoft institucional (sem senha própria nem e-mail de código). O perfil guarda só o nome de exibição (primeiro + último nome, editável) e o curso.
* Localização coletada **só no momento do registro**, nunca em segundo plano.
* Fotos em bucket **privado**: só o dono e os admins veem.
* **Atenção:** no plano gratuito do Gemini, o Google pode usar o conteúdo enviado para melhorar os modelos. Isso aparece no termo de consentimento do app. Para produção, avaliar o plano pago (sem esse uso).
* Retenção sugerida: apagar as fotos após 60 dias (*a fazer*: job agendado. O texto do consentimento já promete isso).

## 12. Material para o relatório da UPX

**Objetivo geral (sugestão):** incentivar o descarte correto de resíduos na comunidade acadêmica da Facens por meio de um aplicativo web progressivo gamificado que valida descartes com inteligência artificial e geolocalização e recompensa os usuários com pontos, ranking e premiações mensais.

**Objetivos específicos (sugestão):**
1. Mapear e cadastrar os pontos de coleta seletiva do campus.
2. Desenvolver um PWA com registro de descarte por foto, validação por IA e geolocalização.
3. Implementar mecanismos de gamificação (pontos, níveis, conquistas, ranking mensal e por curso).
4. Implementar mecanismos antifraude (hash perceptual, limites, revisão e auditoria).
5. Realizar um piloto com alunos e medir adesão, acurácia da IA e satisfação.
6. Gerar dados sobre os resíduos descartados (tipo, local, horário) para a campanha Lixo Zero.

**Orçamento (sugestão):**

| Item | Custo |
|---|---|
| Supabase (plano Free) | R$ 0 |
| Vercel (plano Hobby) | R$ 0 |
| Google Gemini API (camada gratuita) | R$ 0 |
| Domínio `ranktrash.eco.br` (registro.br) | ~R$ 40/ano |
| Envio de e-mail (Resend, até 3.000/mês) | R$ 0 |
| Adesivos/placas para as lixeiras | ~R$ 50 |
| Prêmios mensais (top 3) | a definir (patrocínio?) |

**Validação (procedimento sugerido):** piloto de 2 semanas com um grupo de alunos.
* **Adesão:** usuários ativos por dia e registros por dia.
* **Qualidade:** % de registros aprovados, recusados e em revisão.
* **Acurácia da IA:** comparar a classificação da IA com a revisão humana numa amostra de 100 fotos (matriz de confusão por material).
* **Usabilidade:** questionário SUS (System Usability Scale).
* **Impacto:** itens/kg por material e por lixeira, comparados à pesagem da coleta (se a Facens tiver esse dado).

**Retorno esperado:**
* *Tangível:* mais resíduos recicláveis separados corretamente (kg/mês por material) e dados de descarte por local/horário.
* *Intangível:* educação ambiental (o app ensina em qual lixeira cada item vai), engajamento dos alunos com o Lixo Zero e visibilidade da Facens.

## 13. Perguntas em aberto para o grupo

1. Quais são os pontos de coleta reais do campus e quais materiais cada um aceita?
2. Qual é o domínio de e-mail dos alunos (`@facens.br`? outro?)
3. Prêmios: quem patrocina? A Facens topa dar algo (horas complementares, brindes)?
4. Quem serão os admins (professor orientador, equipe Lixo Zero)?
5. Nome e logo finais.
