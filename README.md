<div align="center">

# 📨 Convida Aí

**Transforma quem reagiu aos seus posts em seguidores da sua página do Facebook.**

Uma extensão para Firefox que abre a lista de reações de cada post e clica em **Convidar** em todo mundo que ainda não segue a página, com calma, sem pressa e sem chamar a atenção do Facebook.

![Firefox](https://img.shields.io/badge/Firefox-109%2B-FF7139?logo=firefoxbrowser&logoColor=white)
![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)
![Idiomas](https://img.shields.io/badge/Facebook-PT--BR%20%7C%20PT--PT%20%7C%20EN-1877F2)

</div>

---

## 🤔 Por que existe

Todo post da sua página tem uma lista de pessoas que reagiram. Quem ainda não segue a página aparece com um botão **Convidar**. Clicar nesses botões é o jeito mais barato de crescer, porque são pessoas que já gostaram do seu conteúdo.

O problema é que, numa página com anos de história, são milhares de posts e dezenas de milhares de cliques. O **Convida Aí** faz esse trabalho por você, aos poucos, todos os dias, até acabar.

## ✨ O que ele faz

- 🎯 **Convida só quem falta:** ignora quem já foi convidado ou já segue a página.
- 📜 **Varre todo o histórico:** importa a lista de **todos** os posts pela Graph API em segundos, sem precisar rolar 9 anos de feed.
- ⏱️ **Pausas humanas:** espera um intervalo aleatório entre convites e entre posts.
- 📊 **Limite diário:** quando chega no limite, pausa e **retoma sozinho no dia seguinte**.
- 🛑 **Freio de emergência:** se o Facebook mostrar "Você não pode usar este recurso agora", **para tudo** na hora.
- 💾 **Retoma de onde parou:** o progresso fica salvo, e você pode recomeçar de qualquer post.
- 🖥️ **Painel na página:** mostra o progresso em tempo real, com um botão **Parar** sempre à mão.

## 🚀 Instalação

### Teste rápido (temporário)
1. Baixe ou clone este repositório.
2. No Firefox, abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária…** e escolha o `manifest.json`.

> A extensão temporária some quando o Firefox fecha.

### Pelo lançador (Windows)
Dê dois cliques em `abrir-firefox-com-extensao.bat`. Ele abre um **Firefox separado**, com um perfil só da extensão, e já carrega a extensão. Na primeira vez, faça login no Facebook nessa janela.

Requer [Node.js](https://nodejs.org/). Use essa janela só para a extensão, porque o perfil dela vem com configurações de desenvolvimento.

### Permanente
O Firefox normal só instala extensões assinadas pela Mozilla. A assinatura é gratuita e a extensão fica privada, só para você:

```bash
npx web-ext sign --channel=unlisted --api-key=SEU_JWT_ISSUER --api-secret=SEU_JWT_SECRET
```

As chaves ficam em [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/). Depois é só arrastar o `.xpi` gerado para o Firefox.

## 🕹️ Como usar

Clique no ícone **Convida Aí** na barra do Firefox. São três modos:

| Modo | Quando usar |
|---|---|
| **Fila de posts** ⭐ | Para varrer o histórico inteiro da página. É o modo recomendado. |
| **Varrer feed da página** | Para os posts mais recentes, direto na página. |
| **Convidar no diálogo aberto** | Para um post específico: abra a lista de reações e clique. |

### Fila de posts: passo a passo

1. Abra o [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Em **Usuário ou Página**, escolha **Obter token de acesso da página** e selecione a sua página.
3. Marque as permissões `pages_show_list` e `pages_read_engagement`, e gere o token.
4. Cole o token no popup e clique em **Importar todos os posts**. Posts sem reações são descartados.
5. Clique em **Iniciar fila**.

A extensão abre uma janela própria e visita um post por vez. Deixe essa janela trabalhando:

- ✅ pode ficar **atrás de outras janelas**;
- ❌ **não minimize**: minimizada, a página para de carregar mais nomes.

## ⚙️ Configurações

| Opção | Padrão | O que faz |
|---|---|---|
| Pausa mínima / máxima entre convites | 3 s / 7 s | Intervalo aleatório entre cada clique |
| Limite por dia | 300 | Ao chegar no limite, a extensão pausa até o dia seguinte |
| Pausa entre posts | 4 s | Descanso antes de abrir o próximo post |

> 💡 **Dica:** comece com 100 a 150 convites por dia e aumente aos poucos se não aparecer bloqueio.

## 🔍 Como funciona por dentro

```
post ──▶ ícones de "Vê quem reagiu a isto" ──▶ diálogo de reações
                                                  │
                                       aba "Tudo" ◀┘
                                                  │
              rola a lista ──▶ clica em cada "Convidar" ──▶ pausa aleatória
                                                  │
                  fim da lista ──▶ fecha o diálogo ──▶ próximo post
```

A extensão não clica no número de reações ao lado do botão de reagir, porque no layout atual ele faz parte desse botão, e clicar ali **removeria a reação da página**.

### Estrutura

```
manifest.json                   configuração da extensão
background.js                   fila, contadores, limite diário, importação via Graph API
content.js                      roda no facebook.com: abre diálogos e clica em Convidar
popup.html / popup.js           painel de controle
abrir-firefox-com-extensao.bat  lançador com perfil separado (Windows)
```

## 🌍 Idiomas suportados

A extensão encontra os elementos pelo texto da interface do Facebook. Ela reconhece **português do Brasil**, **português de Portugal** e **inglês**.

Se o Facebook mudar algum texto ou você usar outro idioma, ajuste as constantes no topo do `content.js`:

```js
const INVITE_LABELS = ['convidar', 'invite'];
const TRIGGER_RE = /(v[eê]r? quem reagiu|see who reacted|todas as reações|all reactions)/i;
const ALL_TAB_RE = /^(tudo|todas|all)$/i;
```

## 🩺 Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Desce o feed mas não abre nenhuma lista | Os textos da interface mudaram. Veja [Idiomas suportados](#-idiomas-suportados) |
| Para sozinho depois de alguns posts | A janela foi minimizada, ou o Facebook bloqueou o recurso (veja o painel) |
| "Abra uma aba do facebook.com" | Recarregue a página do Facebook depois de instalar ou atualizar a extensão |
| Post pulado na fila | O post não carregou em 3 minutos, ou não tem lista de reações (alguns vídeos) |

## ⚠️ Aviso importante

- O Facebook **limita** quantos convites cada página pode enviar. Passar do limite bloqueia o recurso temporariamente. A extensão para sozinha quando isso acontece, e o melhor é esperar pelo menos 24 h.
- Automatizar ações pode violar os [Termos do Facebook](https://www.facebook.com/terms). **Use por sua conta e risco**: a responsabilidade é de quem usa.
- Este projeto **não tem nenhuma relação** com a Meta Platforms, Inc.

## 🤝 Contribuindo

Achou um texto da interface que não é reconhecido? O Facebook mudou o layout? Abra uma *issue* ou mande um *pull request*. Informar o idioma e o texto exato que aparece na tela já ajuda muito.

## 📄 Licença

[MIT](LICENSE) © 2026 Luiz Nai

<div align="center">

Feito com ☕ por Luiz Nai · 📺 <a href="https://www.youtube.com/@NaiAdventure">YouTube</a> · 📸 <a href="https://www.instagram.com/canal_naiadventure/">Instagram</a>

</div>
