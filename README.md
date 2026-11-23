# Controle de Afastamentos — CPP Joinville

Aplicação web para planejamento, visualização e validação automática da escala de afastamentos dos servidores e colaboradores da CPP Joinville (**Férias**, **Licença-Prêmio**, **Curso/Convocação** e **Afastamento Médico (LTS/LTF)**), com sincronização direta em planilhas do **Google Sheets** por meio da conta Google da unidade.

---

## Arquitetura e funcionamento do sistema

Este sistema foi projetado para ser simples de manter, seguro e livre de servidores próprios. Na prática, ele funciona como uma **interface inteligente no navegador** que se conecta diretamente ao **Google Drive / Google Sheets** da delegacia após o usuário fazer login.

### Diagrama de funcionamento

```mermaid
flowchart LR
    Dev["Alteração no Código"] -->|git push na branch main| GH["GitHub<br/>(Repositório do código-fonte)"]
    GH -->|dispara compilação| GHA["GitHub Actions<br/>(Compila e empacota o site)"]
    GHA -->|publica versão atualizada| GHP["GitHub Pages<br/>(Disponibiliza o site na internet)"]

    User["Navegador do Usuário<br/>(Frontend React)"] -->|1. Acessa a página| GHP
    User -->|2. Faz login Google OAuth| FB["Firebase Authentication<br/>(Autenticação e autorização)"]
    FB -->|3. Retorna token temporário<br/>em memória| User
    User <-->|4. Lê e grava afastamentos diretamente| GS["Google Drive e Google Sheets<br/>(Armazenamento oficial dos dados)"]
```

### Papel de cada serviço

| Serviço | Função no sistema |
| --- | --- |
| **GitHub** | Onde o código-fonte do projeto fica armazenado, organizado e versionado (histórico de alterações). |
| **GitHub Actions** | A esteira automática que, a cada alteração enviada para o GitHub, instala as dependências, compila a aplicação e prepara os arquivos finais do site. |
| **GitHub Pages** | O serviço de hospedagem estática que disponibiliza a aplicação na internet para ser acessada pelo navegador, sem necessidade de contratar servidor próprio. |
| **Firebase (Authentication)** | Responsável exclusivamente pela autenticação dos usuários com a conta Google (OAuth 2.0) e pela emissão da autorização temporária para acessar o Google Drive e o Google Sheets. **Não armazena dados da escala.** |
| **Google Sheets (e Google Drive)** | Onde os dados efetivos e oficiais da gestão (servidores, equipes, cargos, tipos e períodos de afastamento) ficam armazenados, protegidos pelas permissões de compartilhamento da própria conta Google da unidade. |

### Três características essenciais da arquitetura

1. **Execução no navegador (Frontend):** toda a interface, os filtros, os gráficos de cronograma e as regras de verificação de conflitos rodam diretamente no navegador do usuário.
2. **Sem backend próprio:** não existe nenhum servidor intermediário, banco de dados paralelo ou API própria guardando cópias dos afastamentos da delegacia.
3. **Comunicação direta com o Google:** depois do login, o navegador conversa diretamente com as APIs oficiais do Google (`Drive` e `Sheets`) usando a autorização concedida pelo usuário autenticado.

---

### Perguntas frequentes sobre operação, falhas e segurança

- **Onde estão armazenados os dados?**
  Todos os dados reais ficam exclusivamente na planilha do **Google Sheets** escolhida ou criada no **Google Drive** da conta conectada. O código publicado no GitHub contém apenas o programa e uma escala fictícia de exemplo para prévia inicial.

- **Quais informações são públicas e quais permanecem privadas?**
  - **Públicas (no repositório do GitHub):** o código-fonte da aplicação, as regras gerais de validação, os arquivos de compilação e os registros fictícios de demonstração (`src/data/seedFerias2027.ts`), além das chaves públicas de identificação do app necessárias para o navegador iniciar o login com o Google.
  - **Privadas:** os nomes reais dos servidores, datas oficiais, planilhas internas do Google Drive e o token temporário de acesso da sessão (que fica somente na memória do navegador durante o uso e nunca é salvo em disco ou banco externo). Somente usuários que já têm permissão na planilha dentro do Google Drive conseguem lê-la ou editá-la pelo sistema.

- **O que acontece quando uma alteração é feita no código?**
  Quando uma atualização é enviada para a branch `main` no GitHub, o **GitHub Actions** inicia automaticamente um novo build e publica a versão atualizada no **GitHub Pages** em poucos minutos. Os dados que já estão na planilha do Google Sheets não são apagados nem modificados por atualizações no código.

- **Se o GitHub sair do ar, o que acontece?**
  - Se o **repositório GitHub** tiver uma instabilidade, o site já publicado no GitHub Pages geralmente continua acessível, mas novas atualizações de código ficam aguardando.
  - Se o **GitHub Pages** sair do ar, a página do aplicativo não abre temporariamente, porém **nenhum dado é perdido**: a planilha oficial continua intacta e acessível normalmente direto pelo Google Drive / Google Sheets.

- **Se o Firebase deixar de funcionar, o que acontece?**
  O botão de **Entrar com Google** (login OAuth) fica temporariamente indisponível, impedindo novas autenticações para acessar a planilha. O site continua abrindo em modo de prévia local e os dados já salvos no Google Sheets permanecem preservados.

- **Se o Google Sheets (ou Google Drive) ficar indisponível, o que acontece?**
  A interface abre normalmente no navegador, mas não consegue listar, carregar ou salvar alterações na planilha oficial enquanto a instabilidade durar. Quando o usuário tenta gravar ou excluir algum registro nessas condições, a operação é bloqueada com mensagem de erro para evitar divergência com a planilha.

---

## Principais Funcionalidades

- **Múltiplos Tipos de Afastamento:**
  - Suporte nativo a **Férias**, **Licença-Prêmio**, **Curso/Convocação** e **Afastamento Médico (LTS/LTF)**, cada um identificado por cor própria no cronograma, no calendário mensal e nos relatórios exportados.
  - Lançamentos ilimitados por servidor (agrupados automaticamente na linha do servidor na timeline anual).
- **Seção Dedicada para Terceirizados:**
  - Exibição em bloco separado dos servidores policiais (`Alfa`, `Bravo`, `Charlie`, `Delta`, `Volante`, `Coordenação`), sem aplicar regras de conflito da escala policial aos colaboradores terceirizados.
- **Cronograma Anual (Timeline):**
  - Visão de 12 meses por servidor/colaborador, com seletor dinâmico de ano, atalho para adicionar novo afastamento diretamente na linha do servidor e filtros combináveis por **Tipo de Afastamento**, **Equipe**, **Cargo**, **Situação** (`Regulares` / `Conflitos`) e **Busca por nome**.
- **Calendário Mensal:**
  - Grade diária mostrando todos os servidores afastados em cada data do mês selecionado, com destaque visual para conflitos e painel lateral para consulta por dia específico.
- **Motor de Validação Operacional em Cascata:**
  1. **Meses vedados para férias:** bloqueia períodos de **Férias** de servidores policiais que atinjam **Janeiro**, **Fevereiro** ou **Dezembro**. Outros tipos de afastamento (`Licença-Prêmio`, `Curso/Convocação` e `Afastamento Médico (LTS/LTF)`) são permitidos nesses meses.
  2. **Mesmo cargo na mesma equipe:** impede afastamentos coincidentes (de qualquer tipo) entre dois servidores policiais do mesmo cargo na mesma equipe.
  3. **Delegado e Escrivão:** impede que Delegado e Escrivão da mesma equipe coincidam períodos de afastamento (de qualquer tipo).
  4. **Sobreposição própria e consistência de datas:** valida datas de início/término e impede sobreposição entre lançamentos do mesmo servidor.
- **Gestão Assistida com Planilha Google:**
  - Seleção de planilha e aba existentes no Google Drive, vínculo por URL/ID ou criação automática da planilha padrão `Controle_de_Afastamentos_CPP_Joinville` (aba `Afastamentos 2027`).
  - Reconexão automática à última planilha utilizada vinculada separadamente por conta Google autenticada.
  - Confirmação explícita em modal antes de gravar, atualizar ou excluir linhas na planilha oficial.
- **Exportação de Relatórios:**
  - Geração local de arquivo `.csv` (compatível com Excel) e relatório `.html` autônomo com tipo de afastamento, duração e detalhamento de conflitos.

---

## Estrutura Esperada na Planilha (Google Sheets)

### Formato padrão (1 lançamento por linha)

A aplicação trata a linha 1 (ou a linha de cabeçalho detectada) como cabeçalho e lê/grava os lançamentos a partir da **linha 2**:

| Coluna | Descrição |
| --- | --- |
| `Equipe` | `Alfa`, `Bravo`, `Charlie`, `Delta`, `Volante`, `Coordenação` ou `Terceirizado` |
| `Servidor` | Nome do servidor ou colaborador |
| `Cargo` | `Delegado`, `Escrivão`, `Agente` ou `Terceirizado` |
| `Tipo de Afastamento` | `Férias`, `Licença-Prêmio`, `Curso/Convocação` ou `Afastamento Médico (LTS/LTF)` |
| `Início` | Data inicial do afastamento (`DD/MM/AAAA` ou `AAAA-MM-DD`) |
| `Fim` | Data final do afastamento (`DD/MM/AAAA` ou `AAAA-MM-DD`) |
| `Dias` | Quantidade de dias corridos (inclusivo) |

> **Compatibilidade:** o leitor também reconhece variações de cabeçalho em português (como `Plantão`, `Setor`, `Policial`, `Função`, `Afastamento`, `Motivo/Categoria`, `Data inicial do Afastamento`, `Data final do Afastamento`), suporta linhas de título antes do cabeçalho e mantém compatibilidade retroativa com planilhas legadas que utilizam 2 períodos na mesma linha (`Início – período 1/2`, `Fim – período 1/2`).

---

## Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Ícones e Animações:** `lucide-react`, `motion`
- **Autenticação e APIs Google:** Firebase Authentication (Google Provider), Google Drive API v3 e Google Sheets API v4
- **Testes Unitários:** `node:test` + `tsx`

---

## Executando Localmente (Desenvolvedores)

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

O repositório inclui o workflow `.github/workflows/deploy.yml`, configurado para compilar com o caminho base do repositório e publicar automaticamente a cada `push` na branch `main`.

Para ativar em um repositório novo:
1. Em **Settings → Pages**, defina **Source** como **GitHub Actions**.
2. Em **Firebase Console → Authentication → Settings → Domínios autorizados**, garanta que o domínio `*.github.io` utilizado esteja autorizado.
3. No **Google Cloud Console** do projeto vinculado ao `firebase-applet-config.json`, mantenha as APIs **Google Drive API** e **Google Sheets API** habilitadas (e os usuários autorizados na tela de permissão OAuth, caso o app esteja em modo de teste).
