# 🔒 Guia de Segurança — Ponto (出勤簿)

Documento de referência para manter o app e o repositório protegidos.

---

## 1. Regras de ouro

1. **NUNCA** cole tokens, senhas ou chaves no chat, em issues, ou em qualquer lugar compartilhado.
2. **NUNCA** coloque token na URL do remote Git (`https://token@github.com/...`). Ele fica
   salvo em texto puro no `.git/config`.
3. Use `gh auth login` (device flow) — a credencial fica no gerenciador do `gh`, não no repo.
4. Tokens **fine-grained** com escopo mínimo (`Contents: Read and write` só no repo `Ponto`).
5. Sempre defina **expiração** no token (ex.: 90 dias).

---

## 2. Por que o `.git/config` é perigoso se exposto

O arquivo `.git/config` guarda a **URL do remote**. Se alguém coloca um token ali:

```
[remote "origin"]
    url = https://oauth2:<TOKEN>@github.com/user/repo.git
```

Qualquer servidor estático que sirva a pasta do projeto (como `python -m http.server`)
passa a **entregar o token para qualquer visitante** — inclusive via túnel público.

**Prevenção:** este projeto usa `serve.py`, que **bloqueia** `.git/`, dotfiles e scripts.

---

## 3. Servidor local seguro (`serve.py`)

Nunca use `python -m http.server` direto na pasta do projeto — ele serve `.git/`!

Use:

```bash
PORT=8085 SERVE_DIR=/sdcard/projetos/ponto python3 serve.py
```

O `serve.py` bloqueia:
- Qualquer coisa que comece com `.` (dotfiles/dirs → `.git`, `.env`, `.bak`)
- Arquivos `*.py`, `*.sh`, `*.mjs`, `*.log`, `*.bak`, `*.apk`
- Listagem de diretório (retorna 403)

Há `start_tunnel.sh` que já sobe tudo certo (serve.py + cloudflared).

---

## 4. Antes de cada commit — checklist

- [ ] `git status` não mostra `.env`, `*.key`, `*.pem`, backups com segredos
- [ ] `git remote -v` mostra URL **sem** token
- [ ] Nenhum arquivo novo contém strings tipo `ghp_`, `gho_`, `github_pat_`

Varredura rápida:

```bash
grep -rIn -E "ghp_|gho_|github_pat_|oauth2:" . --exclude-dir=node_modules --exclude-dir=.git
```

Use `./deploy.sh` — ele faz essas checagens automaticamente antes de commitar.

---

## 5. Se um token vazar (FAZER IMEDIATAMENTE)

1. **Revogar o token:**
   - Classic: https://github.com/settings/tokens
   - Fine-grained: https://github.com/settings/personal-access-tokens
2. Gerar um novo (escopo mínimo + expiração).
3. Remover do remote, se estiver na URL:
   ```bash
   git remote set-url origin https://github.com/Thiagoek85/Ponto.git
   ```
4. Se o token foi commitado, **remover do histórico** (`git filter-repo`) e force-push —
   revogar já resolve o acesso, mas o histórico ainda conteria o segredo envenenado.
5. Verificar se nada suspeito aconteceu na conta (sessões ativas, apps autorizados).

---

## 6. Gerenciamento de credenciais (formas seguras)

| Método | Onde guarda | Recomendado |
|---|---|---|
| `gh auth login` | gerenciador do gh | ✅ **melhor** |
| `git config credential.helper store` | `~/.git-credentials` (texto) | aceitável, com permissão 600 |
| Token na URL do remote | `.git/config` (texto) | ❌ nunca |
| Token colado em chat | vários logs | ❌ nunca |

---

## 7. Túnel público (Cloudflare)

- Quick Tunnels (`*.trycloudflare.com`) **não têm autenticação** e mudam de URL a cada restart.
- Para expor de verdade, use **Named Tunnel + Cloudflare Access (Zero Trust)** — aí exige login
  antes de chegar no app.
- Enquanto usar quick tunnel: **só sirva conteúdo público** (este app é offline/local,
  sem segredos no cliente) e mantenha o `serve.py` bloqueando `.git`/dotfiles.

---

## 8. Deploy

```bash
cd /sdcard/projetos/ponto
./deploy.sh "mensagem do commit"
```

O script:
1. Confere se `gh` está autenticado;
2. Limpa token da URL do remote, se houver;
3. Aborta se detectar arquivos sensíveis;
4. Commit + push.

---

*Última atualização: 2026-10-03*
