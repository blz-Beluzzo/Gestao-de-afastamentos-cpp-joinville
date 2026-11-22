# Gestão de Férias — CPP Joinville

Aplicação web (SPA) para planejamento, visualização e validação automática da escala anual de férias dos servidores da CPP Joinville, com sincronização direta em planilhas do Google Sheets via conta Google institucional.

---

## Principais Funcionalidades

- **Cronograma Anual (Timeline):** visão de 12 meses por servidor, com seletor dinâmico de ano, filtros por equipe (`Alfa`, `Bravo`, `Charlie`, `Delta`, `Volante`, `Coordenação`), cargo (`Delegado`, `Escrivão`, `Agente`), situação (`Válido` / `Conflito`) e busca por nome.
- **Calendário Mensal:** grade diária mostrando quais servidores estão afastados em cada data do mês selecionado.
- **Motor de Validação Operacional em Cascata:**
  1. **Meses vedados:** bloqueia períodos que atinjam **Janeiro**, **Fevereiro** ou **Dezembro**.
  2. **Mesmo cargo na mesma equipe:** impede férias coincidentes de dois servidores do mesmo cargo dentro da mesma equipe.
  3. **Delegado e Escrivão:** impede que Delegado e Escrivão da mesma equipe coincidam períodos de afastamento.
  4. **Consistência de datas:** valida intervalos e impede sobreposição entre o 1º e o 2º período do mesmo servidor.
- **Integração Direta com Google Drive e Google Sheets:**
  - Login com Google OAuth (via Firebase Authentication), solicitando apenas os escopos necessários (`drive.readonly` e `spreadsheets`).
  - Seleção de planilha e aba existentes no Google Drive ou criação automática de uma nova planilha formatada.
  - Confirmação explícita em modal antes de gravar, atualizar ou excluir linhas na planilha oficial.
- **Exportação de Relatórios:** geração local de arquivo `.csv` (compatível com Excel) e relatório `.html` autônomo com o detalhamento de conflitos.

---

## Estrutura Esperada na Planilha (Google Sheets)

As colunas padrão reconhecidas pelo sistema são:

| Coluna | Descrição |
| --- | --- |
| `Equipe` | `Alfa`, `Bravo`, `Charlie`, `Delta`, `Volante` ou `Coordenação` |
| `Servidor` | Nome do servidor |
| `Cargo` | `Delegado`, `Escrivão` ou `Agente` |
| `Início – período 1` | Data inicial do 1º período (`DD/MM/AAAA` ou `AAAA-MM-DD`) |
| `Fim – período 1` | Data final do 1º período |
| `Dias – período 1` | Quantidade de dias (calculada ou fórmula) |
| `Início – período 2` | Data inicial do 2º período |
| `Fim – período 2` | Data final do 2º período |
| `Dias – período 2` | Quantidade de dias (calculada ou fórmula) |
| `Total de dias` | Soma dos períodos |

> O leitor também aceita variações de cabeçalho em português (como `Plantão`, `Policial`, `Função`, `Término 1/2`), linhas de título antes do cabeçalho e abas sem linha de cabeçalho.

---

## Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Ícones e Animações:** `lucide-react`, `motion`
- **Autenticação e APIs Google:** Firebase Authentication (Google Provider), Google Drive API v3 e Google Sheets API v4
- **Testes Unitários:** `node:test` + `tsx`

---

## Executando Localmente

### Pré-requisitos
- Node.js 20+
- npm

### Instalação e desenvolvimento
```bash
npm install --legacy-peer-deps
npm run dev
```
A aplicação ficará disponível em `http://localhost:3000`.

### Scripts úteis
```bash
# Verificação de tipos TypeScript
npm run lint

# Testes unitários (regras operacionais e parser do Google Sheets)
npx tsx --test src/utils/validarFerias.test.ts src/services/googleSheetsService.test.ts

# Build de produção
npm run build
```

---

## Deploy no GitHub Pages

O repositório já inclui o workflow `.github/workflows/deploy.yml`, configurado para compilar com o caminho base do repositório e publicar automaticamente a cada `push` na branch `main`.

Para ativar em um repositório novo:
1. Em **Settings → Pages**, defina **Source** como **GitHub Actions**.
2. Em **Firebase Console → Authentication → Settings → Domínios autorizados**, certifique-se de que o domínio `*.github.io` utilizado esteja autorizado.
3. No **Google Cloud Console** do projeto vinculado ao `firebase-applet-config.json`, mantenha as APIs **Google Drive API** e **Google Sheets API** habilitadas (e os usuários autorizados na tela de permissão OAuth, caso o app esteja em modo de teste).

---

## Segurança e Privacidade

- **Sem backend intermediário:** após o login OAuth, todas as leituras e gravações acontecem diretamente entre o navegador do usuário autenticado e as APIs do Google.
- **Tokens em memória:** o token de acesso do Google Workspace não é gravado em `localStorage` nem `sessionStorage`; apenas o ID da última planilha selecionada é lembrado por conta.
- **Dados reais fora do código:** os registros contidos em `src/data/seedFerias2027.ts` são exclusivamente fictícios para prévia local. Os dados reais da unidade devem permanecer apenas na planilha privada do Google Drive, protegida pelas permissões de compartilhamento da delegacia.
