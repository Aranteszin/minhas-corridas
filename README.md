# Minhas Corridas

App de controle de ganhos para motorista de aplicativo. Feito para rodar no celular,
instalado na tela inicial, **sem internet, sem login e sem servidor**.

---

## O que ele faz

**Três lançamentos, todos em poucos segundos:**

| Botão | O que anota |
|---|---|
| 🚗 **Lançar dia** | quanto ganhou (bruto), km rodados, horas na rua, nº de corridas |
| ⛽ **Abastecer** | valor pago, preço do litro *ou* litros (calcula o outro), km do painel, posto |
| 🧾 **Despesa** | valor + categoria (manutenção, lavagem, pedágio, seguro, IPVA...) |

**E calcula sozinho**, com filtro de Hoje / Semana / Mês / Tudo:

- **Lucro líquido** — ganhos menos combustível menos despesas
- **R$ por hora líquido** — o número que diz se valeu a pena trabalhar
- **R$ por km** bruto e **custo por km**
- **Consumo real (km/l)** — medido entre abastecimentos de tanque cheio
- **Km rodados**, dias trabalhados e média por dia
- **Gráfico** de ganho dos últimos 14 dias
- **Melhores dias da semana** — ajuda a decidir quando sair
- **Metas** de dia e de semana, com barra de progresso
- **Manutenção** — avisa quantos km faltam para a revisão, com base no odômetro
- **Exportar CSV** (abre no Excel) e **backup / restauração** em arquivo

---

## Como colocar no celular do seu pai

O app é só um site estático — qualquer hospedagem gratuita serve. Precisa ser **HTTPS**
(ou `localhost`), senão o modo offline não liga.

### Opção 1 — GitHub Pages (grátis e permanente)

```bash
cd ~/Documents/painel-motorista
git init && git add . && git commit -m "Minhas Corridas"
gh repo create minhas-corridas --public --source=. --push
```

Depois, no repositório: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Em um ou dois minutos o app fica em `https://SEU-USUARIO.github.io/minhas-corridas/`.

### Opção 2 — Netlify Drop

Arraste a pasta `painel-motorista` inteira para [app.netlify.com/drop](https://app.netlify.com/drop).
Sai uma URL HTTPS na hora.

### Instalar na tela inicial

Abra o link no celular dele e:

- **Android (Chrome):** menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*)
- **iPhone (Safari):** botão de compartilhar → *Adicionar à Tela de Início*

Pronto — abre como aplicativo, em tela cheia, e funciona sem internet.

---

## Onde ficam os dados

**No próprio celular** (`localStorage`), não na nuvem. Ninguém mais vê, nem eu, nem você.

O outro lado disso: se o celular quebrar ou o app for desinstalado, os dados se perdem.
Por isso existe o **Salvar backup** em Ajustes — vale fazer uma vez por mês e mandar o
arquivo para o WhatsApp dele. O **Restaurar backup** traz tudo de volta.

Atualizar o site (publicar uma versão nova) **não apaga** nada.

---

## Mexer no código

Não tem build, não tem dependência, não tem `npm install`. São cinco arquivos:

```
index.html      as três telas (Painel, Histórico, Ajustes) e o formulário
styles.css      todo o visual; as cores ficam nas variáveis do :root
app.js          dados, cálculos e telas — dividido em 10 seções comentadas
manifest.json   nome, cores e ícones do app instalado
sw.js           service worker: é o que faz funcionar sem internet
icons/          gerados por código (volante verde)
```

Para editar, abra e salve. Para ver o resultado, suba um servidor local:

```bash
cd ~/Documents/painel-motorista && python3 -m http.server 4173
```

> **Atenção (macOS):** o Terminal precisa ter permissão de acesso à pasta Documentos,
> senão o servidor responde 404. Se acontecer, copie a pasta para fora de `~/Documents`
> ou libere em *Ajustes do Sistema → Privacidade e Segurança → Arquivos e Pastas*.

Ao publicar uma versão nova, mude `const CACHE = 'minhas-corridas-v1'` em `sw.js`
para `v2`, `v3` etc. — é isso que faz o celular baixar os arquivos atualizados.

---

## Ideias para depois

- Aluguel do carro como custo fixo semanal (hoje o app assume carro próprio)
- Comparar mês a mês
- Guardar o preço do litro por posto, para saber onde compensa abastecer
- Separar ganhos por aplicativo (Uber, 99, particular)
