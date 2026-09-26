# 出勤簿 — Registro de Ponto

App local (offline) para registrar diariamente **entrada, saída e local de trabalho** e gerar
automaticamente o relatório mensal **出勤簿** em Excel (`.xlsx`) no layout oficial.

Funciona no navegador do celular, sem internet e sem instalar nada. Os dados ficam salvos
no próprio aparelho.

## Como abrir no celular

1. Abra o **Chrome**.
2. Digite na barra de endereços:
   `file:///sdcard/projetos/ponto/ponto.html`
3. Pronto. Dica: use **⋮ → Adicionar aos favoritos** para abrir rapidinho todo dia.

> `ponto.html` é um arquivo único e autocontido (HTML + CSS + JS + biblioteca Excel).
> Você pode copiá-lo para qualquer pasta e abrir direto.

### Alternativa (recomendada para uso diário)

Se tiver o **Termux**, rode um servidor local (dá origem "de verdade", mais estável para
salvar dados e permite instalar como app):

```bash
cd /sdcard/projetos/ponto
python -m http.server 8000
# depois abra http://localhost:8000/ponto.html no Chrome
```

## Fluxo diário

1. **今日 / Hoje** → ao chegar, toque em **出社 (Entrada)**; ao sair, **退社 (Saída)**.
   O horário atual é gravado automaticamente (pode ajustar depois).
2. Escolha o **local** (日向電子所 / ダイフク / outros) e a **marca** (○ △ ×).
3. Escreva observações em **備考** se precisar (ex.: `休み`).
4. No fim do mês: aba **月 / Mês** → **Gerar Excel (.xlsx)**.

### Turno noturno (ex.: 18:30 → 06:30)

Se você bater a entrada e esquecer de bater a saída (ou sair depois da meia-noite), o app
mostra um aviso **“Turno em aberto”** no topo. Basta tocar em **退社 agora** para registrar
a saída no turno certo — o app calcula corretamente as horas atravessando a meia-noite.

### Editar qualquer dia

Aba **月 / Mês** → toque no dia para abrir e ajustar entrada/saída/local/marca/obs.

## O Excel gerado

Duas abas:

- **出勤簿** — cabeçalho (ano/mês, 所属長, 申請者), tabela `日 / 出社時 / 退社時 / 主な行き先 / 勤怠 / 備考`,
  fins de semana e feriados japoneses coloridos (regra ③) e as 4 observações oficiais no rodapé.
  Dias com **休日出勤** marcam a hora trabalhada em 勤怠 e os horários em 備考 (regra ②).
- **集計** — resumo: dias trabalhados, total de horas, horas extras, nº de plantões noturnos, feriados.

O arquivo baixa como `shukkinbo_AAAA-MM.xlsx`.

## Backup

Os dados ficam só neste aparelho (localStorage). **Faça backup com frequência**:
aba **設定 / Ajustes → Exportar backup (.json)**. Para restaurar, use **Importar backup**.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `ponto.html` | **App completo em arquivo único** — é o que você abre no celular |
| `index.html`, `style.css`, `app.js`, `exceljs.min.js` | Código-fonte (versão em vários arquivos) |
| `build.mjs` | Gera `ponto.html` a partir do código-fonte (`node build.mjs`) |
| `README.md` | Este arquivo |

## Personalização

Aba **設定 / Ajustes**:
- **Nome** (申請者) e **Supervisor** (所属長) — aparecem no cabeçalho do relatório.
- **Jornada padrão/dia** — usada só para calcular a coluna de horas extras.
- **Locais** — adicione/remova os locais de trabalho.

### Feriados japoneses

A coloração de feriados usa uma lista fixa em `app.js` (`JP_HOLIDAYS`) para 2026 e 2027.
Para anos seguintes, acrescente as datas nesse objeto.

### Nome do arquivo

O download usa nome ASCII (`shukkinbo_2026-06.xlsx`) porque o Chrome descarta caracteres
japoneses no nome do arquivo. O **conteúdo** da planilha permanece todo em japonês (出勤簿).
Se quiser, renomeie para `出勤簿_2026年6月.xlsx` antes de enviar aos superiores.
