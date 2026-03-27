import { useState } from "react"
import { Card, CardContent } from "@/components/ui"
import {
  CheckCircle2, Info, AlertTriangle, ExternalLink, ChevronRight, Download, Smartphone, Monitor
} from "lucide-react"

const BANKS = [
  {
    id: "nubank",
    name: "Nubank",
    color: "#820AD1",
    bg: "from-purple-600/20 to-purple-900/10",
    border: "border-purple-500/30",
    ring: "ring-purple-500/50",
    emoji: "💜",
    format: "CSV",
    profile: "nubank",
    web: "https://nubank.com.br",
    tip: "O Nubank exporta o extrato da conta ou do cartão. Para conta corrente, use o app; para fatura do cartão também é pelo app.",
    steps: [
      {
        platform: "app",
        title: "Extrato da Conta Corrente (App)",
        steps: [
          "Abra o app do Nubank e faça login.",
          "Na tela inicial, toque no ícone ☰ de menu.",
          "Busque por 'Extrato'",
          "Clique em 'Receber extrato por e-mail'",
          "Selecione o período desejado e confirme.",
          "Acesse seu e-mail e baixe o arquivo .csv.",
        ],
      },
      {
        platform: "app",
        title: "Extrato do Cartão de Crédito (App)",
        steps: [
          "Abra o app do Nubank e faça login.",
          "Na tela inicial, toque no ícone ☰ de menu.",
          "Busque por 'Fatura'",
          "Clique em 'Consultar faturas'",
          "Selecione o mês da fatura desejada",
          "Clique no botão de Download no topo da página [↡]",
          "Selecione o formato CSV.",
          "Acesse seu e-mail e baixe o arquivo .csv.",
        ],
      },
    ],
  },
  {
    id: "inter",
    name: "Banco Inter",
    color: "#FF7A00",
    bg: "from-orange-500/20 to-orange-900/10",
    border: "border-orange-500/30",
    ring: "ring-orange-400/50",
    emoji: "🟠",
    format: "CSV",
    profile: "inter",
    web: "https://internetbanking.bancointer.com.br",
    tip: "O Inter permite exportar tanto pelo app quanto pelo internet banking. A versão web tem mais opções de filtro de período.",
    steps: [
      {
        platform: "web",
        title: "Pelo Internet Banking (Web)",
        steps: [
          "Acesse internetbanking.bancointer.com.br e faça login.",
          "No menu lateral, clique em \"Extrato\".",
          "Selecione o período desejado (mês/data).",
          "Clique em \"Exportar\" ou no ícone de download (⬇️).",
          "Escolha o formato CSV ou Excel (.xlsx).",
          "O arquivo será baixado automaticamente.",
        ],
      },
      {
        platform: "app",
        title: "Pelo App Inter",
        steps: [
          "Abra o app do Banco Inter.",
          "Toque em \"Conta\" na barra inferior.",
          "Selecione \"Extrato\".",
          "Toque no filtro e selecione o período.",
          "Toque no ícone de compartilhar ou exportar (⬆️ / ⬇️).",
          "Selecione \"Exportar como CSV\".",
          "Salve ou compartilhe o arquivo.",
        ],
      },
    ],
  },
  {
    id: "itau",
    name: "Itaú",
    color: "#EC7000",
    bg: "from-orange-600/20 to-yellow-900/10",
    border: "border-orange-600/30",
    ring: "ring-orange-600/50",
    emoji: "🔷",
    format: "CSV",
    profile: "itau",
    web: "https://www.itau.com.br",
    tip: "O Itaú suporta exportação em OFX (formato bancário padrão) e CSV. O OFX tende a ter dados mais completos.",
    steps: [
      {
        platform: "web",
        title: "Pelo Internet Banking (Web)",
        steps: [
          "Acesse itau.com.br e faça login com sua agência, conta e senha.",
          "No menu principal, clique em \"Conta Corrente\" > \"Extrato\".",
          "Selecione o período desejado.",
          "Procure o botão \"Exportar\" ou \"Salvar como\".",
          "Escolha o formato CSV ou OFX.",
          "O download iniciará automaticamente.",
        ],
      },
      {
        platform: "app",
        title: "Pelo App Itaú",
        steps: [
          "Abra o app Itaú e faça login.",
          "Toque em \"Extrato\" na tela inicial.",
          "Ajuste o período usando o filtro no topo.",
          "Toque nos três pontinhos (⋯) ou no ícone de exportar.",
          "Selecione \"Exportar extrato\" > CSV ou OFX.",
          "Salve o arquivo no dispositivo.",
        ],
      },
    ],
  },
  {
    id: "sicoob",
    name: "Sicoob",
    color: "#009540",
    bg: "from-green-700/20 to-green-900/10",
    border: "border-green-600/30",
    ring: "ring-green-500/50",
    emoji: "🟢",
    format: "CSV",
    profile: "sicoob",
    web: "https://www.sicoob.com.br",
    tip: "O Sicoob é uma cooperativa de crédito. O acesso varia conforme a cooperativa regional, mas o processo geral é pelo internet banking.",
    steps: [
      {
        platform: "web",
        title: "Pelo Internet Banking Sicoob",
        steps: [
          "Acesse sicoob.com.br e clique em \"Acessar internet banking\".",
          "Faça login com sua agência, conta e senha eletrônica.",
          "No menu, vá em \"Conta\" > \"Extrato\".",
          "Selecione o período (início e fim).",
          "Clique em \"Consultar\" e depois em \"Exportar\" ou \"Imprimir\".",
          "Selecione o formato CSV quando disponível.",
          "Salve o arquivo baixado.",
        ],
      },
      {
        platform: "app",
        title: "Pelo App Sicoob",
        steps: [
          "Abra o app Sicoob e faça login.",
          "Toque em \"Extrato\" ou vá em Conta > Extrato.",
          "Defina o período desejado.",
          "Toque no ícone de exportar/compartilhar.",
          "Escolha CSV se disponível, ou PDF como alternativa.",
          "Salve ou compartilhe o arquivo.",
        ],
      },
    ],
  },
  {
    id: "btg",
    name: "BTG Pactual",
    color: "#0033A0",
    bg: "from-blue-800/20 to-blue-900/10",
    border: "border-blue-700/30",
    ring: "ring-blue-600/50",
    emoji: "🔵",
    format: "CSV",
    profile: "btg",
    web: "https://www.btgpactualdigital.com",
    tip: "O BTG Digital oferece exportação diretamente pelo app ou pelo portal web. O formato OFX é o mais compatível.",
    steps: [
      {
        platform: "web",
        title: "Pelo Portal BTG (Web)",
        steps: [
          "Acesse btgpactualdigital.com e faça login.",
          "No menu esquerdo, clique em \"Extrato\" ou \"Conta\".",
          "Selecione o período de extrato desejado.",
          "Clique em \"Exportar\" no canto superior direito.",
          "Escolha o formato (CSV ou OFX).",
          "Salve o arquivo no computador.",
        ],
      },
      {
        platform: "app",
        title: "Pelo App BTG",
        steps: [
          "Abra o app BTG Pactual e faça login.",
          "Toque em \"Conta\" na barra inferior.",
          "Selecione \"Extrato\".",
          "Defina o período usando o filtro.",
          "Toque em \"Exportar\" ou no ícone de compartilhar (⬆️).",
          "Escolha CSV ou OFX e salve o arquivo.",
        ],
      },
    ],
  },
  {
    id: "caixa",
    name: "Caixa Econômica",
    color: "#005CA9",
    bg: "from-blue-600/20 to-blue-900/10",
    border: "border-blue-600/30",
    ring: "ring-blue-500/50",
    emoji: "🏦",
    format: "CSV",
    profile: "custom",
    web: "https://internetbanking.caixa.gov.br",
    tip: "A Caixa exige que você use o senha web ou token para exportar extrato pelo internet banking. No app, a exportação pode ser mais limitada.",
    steps: [
      {
        platform: "web",
        title: "Pelo Internet Banking Caixa (Web)",
        steps: [
          "Acesse internetbanking.caixa.gov.br e faça login com CPF e senha web.",
          "No menu principal, selecione \"Extrato\".",
          "Na tela de extrato, selecione \"Conta Corrente\" ou \"Conta Poupança\".",
          "Escolha o período (início e fim).",
          "Clique em \"Consultar\" e depois em \"Exportar\" ou \"Gravar\".",
          "Selecione o formato OFX ou CSV.",
          "O download iniciará automaticamente.",
        ],
      },
      {
        platform: "app",
        title: "Pelo App Caixa Tem / Caixa",
        steps: [
          "Abra o app Caixa (ou Caixa Tem para contas digitais).",
          "Faça login com CPF e senha.",
          "Toque em \"Extrato\" na tela inicial.",
          "Escolha o período desejado.",
          "Toque em \"Exportar\" ou compartilhar (⬆️).",
          "Selecione PDF ou CSV e salve o arquivo.",
        ],
      },
    ],
  },
]

const PlatformIcon = ({ platform }) => {
  if (platform === "app") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      <Smartphone size={9} /> App
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-muted-foreground border border-border/60">
      <Monitor size={9} /> Web
    </span>
  )
}

export default function TutorialExtrato() {
  const [selected, setSelected] = useState("nubank")
  const bank = BANKS.find(b => b.id === selected)

  return (
    <div className="flex gap-6 animate-fade-in min-h-[calc(100vh-8rem)]">
      {/* Sidebar: bank list */}
      <aside className="w-52 shrink-0 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-3">Selecione o banco</p>
        {BANKS.map(b => (
          <button
            key={b.id}
            onClick={() => setSelected(b.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
              ${selected === b.id
                ? `bg-gradient-to-r ${b.bg} border ${b.border} text-foreground ring-1 ${b.ring}`
                : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <span className="text-xl">{b.emoji}</span>
            <div className="min-w-0">
              <p className="font-semibold truncate">{b.name}</p>
              <p className="text-[10px] opacity-60">{b.format}</p>
            </div>
            {selected === b.id && <ChevronRight size={14} className="ml-auto shrink-0" />}
          </button>
        ))}

        {/* Import tip */}
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1 flex items-center gap-1">
            <Info size={10} /> Dica de importação
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Após baixar o extrato, importe-o em <strong>Transações → Importar CSV</strong> e selecione o banco correspondente.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 space-y-5">
        {/* Bank header */}
        <div className={`rounded-2xl bg-gradient-to-br ${bank.bg} border ${bank.border} p-6`}>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{bank.emoji}</div>
            <div className="flex-1">
              <h1 className="text-2xl font-black">{bank.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">Formato suportado:</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-card/80 border border-border/60">
                  <Download size={10} /> {bank.format}
                </span>
                {bank.profile !== "custom" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                    <CheckCircle2 size={10} /> Perfil automático disponível
                  </span>
                )}
                {bank.profile === "custom" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <AlertTriangle size={10} /> Use modo "Personalizado" na importação
                  </span>
                )}
              </div>
            </div>
            <a
              href={bank.web}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-card/80 border border-border/60 hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
            >
              <ExternalLink size={12} /> Acessar site
            </a>
          </div>

          {/* Tip box */}
          <div className="mt-4 p-3 rounded-xl bg-black/10 border border-white/5 flex items-start gap-2">
            <Info size={13} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{bank.tip}</p>
          </div>
        </div>

        {/* Step-by-step guides */}
        <div className="grid md:grid-cols-2 gap-5">
          {bank.steps.map((guide, gi) => (
            <Card key={gi} className="border border-border/60">
              <CardContent className="pt-5 pb-5">
                {/* Guide header */}
                <div className="flex items-center gap-2 mb-4">
                  <PlatformIcon platform={guide.platform} />
                  <h3 className="text-sm font-bold">{guide.title}</h3>
                </div>

                {/* Steps */}
                <ol className="space-y-3">
                  {guide.steps.map((step, si) => (
                    <li key={si} className="flex gap-3 items-start">
                      <span
                        className="shrink-0 h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5"
                        style={{ background: bank.color + "20", color: bank.color, border: `1px solid ${bank.color}40` }}
                      >
                        {si + 1}
                      </span>
                      <p className="text-xs text-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: step.replace(/"([^"]+)"/g, '<strong class="text-foreground">"$1"</strong>') }}
                      />
                    </li>
                  ))}
                </ol>

                {/* Success indicator */}
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-2 text-success">
                  <CheckCircle2 size={12} />
                  <span className="text-[11px] font-medium">Arquivo pronto para importar em Transações → Importar CSV</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Import guide */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Download size={14} className="text-primary" />
              Como importar no sistema
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { n: 1, label: "Clique em", action: "Transações → Importar CSV" },
                { n: 2, label: "Selecione a conta de destino", action: "" },
                { n: 3, label: "Escolha o banco", action: bank.profile === "custom" ? "Personalizado" : bank.name },
                { n: 4, label: "Selecione o arquivo .csv baixado", action: "" },
              ].map(s => (
                <div key={s.n} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-card border border-border/40">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                    {s.n}
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                  {s.action && <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{s.action}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer navigation */}
        <div className="flex gap-3 justify-between pt-2">
          {BANKS.indexOf(bank) > 0 && (
            <button
              onClick={() => setSelected(BANKS[BANKS.indexOf(bank) - 1].id)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border/60 px-4 py-2 rounded-xl hover:bg-accent transition-colors"
            >
              ← {BANKS[BANKS.indexOf(bank) - 1].name}
            </button>
          )}
          <div className="flex-1" />
          {BANKS.indexOf(bank) < BANKS.length - 1 && (
            <button
              onClick={() => setSelected(BANKS[BANKS.indexOf(bank) + 1].id)}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary border border-primary/20 bg-primary/5 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors"
            >
              {BANKS[BANKS.indexOf(bank) + 1].name} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
