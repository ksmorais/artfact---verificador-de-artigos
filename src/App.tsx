import { useState, useRef, useCallback, useEffect } from 'react'
import { startAnalysis, pollAnalysis, selectClaims, extractedClaims, mapResult, reportUrl, type Job, type ExtractedClaim, type AnalysisResult, type Verdict } from './api'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, loginWithGoogle, logout, authErrorMessage } from './firebase'
import pubmedGovLogo from './assets/pubmed-gov-logo.png'

type VerifyMode = 'url' | 'image'
type AnalysisStatus = 'idle' | 'loading' | 'selecting' | 'done'

interface AccessibilitySettings {
  highContrast: boolean
  textScale: number
  reducedMotion: boolean
}

const HEALTH_AREAS: Record<string, { color: string; bg: string }> = {
  'Neurologia':    { color: '#4d9fff', bg: '#4d9fff18' },
  'Cardiologia':   { color: '#f04060', bg: '#f0406018' },
  'Nutrição':      { color: '#00d4aa', bg: '#00d4aa18' },
  'Oncologia':     { color: '#a78bfa', bg: '#a78bfa18' },
  'Saúde Mental':  { color: '#f5a623', bg: '#f5a62318' },
  'Infectologia':  { color: '#fb923c', bg: '#fb923c18' },
  'Genética':      { color: '#34d399', bg: '#34d39918' },
  'Geral':         { color: '#6b7fa3', bg: '#6b7fa318' },
}

function detectHealthArea(title: string): string {
  const t = title.toLowerCase()
  if (/alzheimer|neuro|cerebr|cogni|memória|demência/.test(t)) return 'Neurologia'
  if (/cardio|coração|pressão|infarto|colesterol/.test(t)) return 'Cardiologia'
  if (/câncer|tumor|oncol|quimio/.test(t)) return 'Oncologia'
  if (/café|vitamina|nutri|dieta|aliment|proteína/.test(t)) return 'Nutrição'
  if (/ansied|depressão|mental|psico|estresse/.test(t)) return 'Saúde Mental'
  if (/vírus|bactéria|infecção|vacina|covid|gripe/.test(t)) return 'Infectologia'
  if (/genética|dna|rna|genoma|cromossomo/.test(t)) return 'Genética'
  return 'Geral'
}

function VerdictBadge({ verdict, size = 'sm' }: { verdict: Verdict; size?: 'sm' | 'lg' }) {
  const map = {
    verified: { label: 'COMPATÍVEL', color: 'text-[--color-teal] border-[--color-teal] bg-[--color-teal-faint]' },
    fake: { label: 'DIVERGENTE', color: 'text-[--color-red] border-[--color-red] bg-[--color-red-faint]' },
    uncertain: { label: 'INCONCLUSIVO', color: 'text-[--color-amber] border-[--color-amber] bg-[--color-amber-faint]' },
  }
  const { label, color } = map[verdict]
  const px = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
  return (
    <span className={`font-mono font-semibold border rounded ${px} ${color} tracking-widest`}>
      {label}
    </span>
  )
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  const verdictLabel = { verified: 'Compatibilidade preliminar', fake: 'Possível divergência', uncertain: 'Resultado misto ou inconclusivo' }

  return (
    <div className="animate-slide-up mt-10 space-y-4">
      {/* Header */}
      <div className="border border-[--color-border] rounded-lg p-5 bg-[--color-surface] space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] text-[--color-muted] tracking-widest">
                #{result.analysisId}
              </span>
              <span className="w-1 h-1 rounded-full bg-[--color-subtle]" />
              <span className="font-mono text-[10px] text-[--color-muted]">{result.publishedDate}</span>
            </div>
            <h2 className="text-base font-semibold text-[--color-foreground] leading-snug">{result.title}</h2>
            <p className="text-xs text-[--color-muted] mt-1">{result.source}</p>
          </div>
          <a href={reportUrl(result.analysisId)} target="_blank" rel="noopener noreferrer" className="text-xs underline">Relatório completo</a>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[--color-border] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <VerdictBadge verdict={result.overallVerdict} size="lg" />
            <span className="text-sm text-[--color-muted]">{verdictLabel[result.overallVerdict]}</span>
          </div>
          {result.articleUrl && (
            <a
              href={result.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-1.5 rounded-md border border-[--color-border] text-xs font-medium text-[--color-foreground] transition-all duration-150 hover:bg-white hover:text-black hover:border-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Ver artigo original
            </a>
          )}
        </div>
      </div>

      {/* Claims */}
      <div className="border border-[--color-border] rounded-lg bg-[--color-surface] overflow-hidden">
        <div className="px-5 py-3 border-b border-[--color-border] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[--color-blue]" />
          <span className="font-mono text-[11px] text-[--color-muted] tracking-widest uppercase">
            Análise de Afirmações
          </span>
        </div>
        <div className="divide-y divide-[--color-border]">
          {result.claims.map((claim, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex items-start gap-3">
                <VerdictBadge verdict={claim.verdict} />
                <p className="text-sm text-[--color-foreground] leading-snug flex-1">{claim.text}</p>
              </div>
              
              <p className="text-xs text-[--color-muted] leading-relaxed">{claim.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Red flags */}
      <div className="border border-[--color-red] border-opacity-30 rounded-lg bg-[--color-red-faint] p-5 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[--color-red]" />
          <span className="font-mono text-[11px] text-[--color-red] tracking-widest uppercase">
            Alertas Detectados
          </span>
        </div>
        {result.redFlags.length === 0 && <p className="text-sm">Nenhum alerta informado nesta análise.</p>}
        {result.redFlags.map((flag, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="font-mono text-[--color-red] text-xs mt-0.5">!</span>
            <p className="text-sm text-[--color-foreground] opacity-90">{flag}</p>
          </div>
        ))}
      </div>

      {/* Sources */}
      <div className="border border-[--color-border] rounded-lg bg-[--color-surface] p-5 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[--color-teal]" />
          <span className="font-mono text-[11px] text-[--color-muted] tracking-widest uppercase">
            Fontes Consultadas
          </span>
        </div>
        {result.supportingLinks.length === 0 && <p className="text-sm">Nenhuma fonte independente disponível nesta análise.</p>}
        {result.supportingLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-[--color-border] text-sm text-[--color-blue] transition-all duration-150 group hover:border-[--color-teal] hover:bg-[--color-teal-faint] hover:text-[--color-teal]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[--color-subtle] group-hover:text-[--color-teal] text-xs shrink-0">→</span>
              <span className="truncate">{link.label}</span>
            </div>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
              <path d="M1 1h9v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── LGPD Terms content (shared between modal and footer) ─────
const LGPD_SECTIONS = [
  {
    title: '1. Identificação do Controlador',
    text: 'A plataforma ArtFact, doravante denominada "Controlador", é responsável pelo tratamento dos dados pessoais coletados neste site, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).',
  },
  {
    title: '2. Dados Coletados',
    text: 'Coletamos os seguintes dados pessoais: (a) nome completo; (b) endereço de e-mail; (c) dados de acesso fornecidos via autenticação Google (nome e e-mail públicos); (d) histórico de artigos verificados associado à conta do usuário. Não coletamos dados sensíveis conforme definido no art. 11 da LGPD.',
  },
  {
    title: '3. Finalidade do Tratamento',
    text: 'Os dados são tratados exclusivamente para: (a) criar e gerenciar a conta do usuário; (b) salvar e recuperar artigos verificados; (c) melhorar a experiência da plataforma; (d) cumprir obrigações legais aplicáveis. O tratamento é fundamentado no consentimento do titular (art. 7º, I, LGPD) e no legítimo interesse do Controlador (art. 7º, IX, LGPD).',
  },
  {
    title: '4. Compartilhamento de Dados',
    text: 'Não comercializamos, alugamos ou compartilhamos dados pessoais com terceiros para fins comerciais. Poderemos compartilhar dados com prestadores de serviços de infraestrutura (ex.: provedores de nuvem) estritamente para operação da plataforma, sob acordo de confidencialidade e com as mesmas garantias desta Política.',
  },
  {
    title: '5. Retenção de Dados',
    text: 'Os dados são mantidos enquanto a conta estiver ativa. Após a exclusão da conta, os dados pessoais serão removidos em até 30 (trinta) dias, salvo obrigação legal de retenção por prazo superior.',
  },
  {
    title: '6. Direitos do Titular',
    text: 'Nos termos dos arts. 17 a 22 da LGPD, o titular tem direito a: (a) confirmação da existência de tratamento; (b) acesso aos dados; (c) correção de dados incompletos, inexatos ou desatualizados; (d) anonimização, bloqueio ou eliminação de dados desnecessários; (e) portabilidade dos dados; (f) eliminação dos dados tratados com consentimento; (g) informação sobre compartilhamentos; (h) revogação do consentimento a qualquer momento.',
  },
  {
    title: '7. Segurança',
    text: 'Adotamos medidas técnicas e administrativas adequadas para proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração ou comunicação indevida, em conformidade com o art. 46 da LGPD.',
  },
  {
    title: '8. Encarregado (DPO)',
    text: 'Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato com nosso Encarregado de Proteção de Dados pelo e-mail: privacidade@artfact.com.br. Responderemos em até 15 (quinze) dias úteis.',
  },
  {
    title: '9. Alterações desta Política',
    text: 'Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas por e-mail ou notificação na plataforma. A data da última atualização consta no rodapé deste documento.',
  },
]

// ── Terms Modal ───────────────────────────────────────────────
function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,12,24,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-[--color-surface] relative animate-slide-up flex flex-col"
        style={{ borderColor: '#00d4aa', maxHeight: 'calc(100vh - 3rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--color-border] shrink-0">
          <div className="space-y-0.5">
            <span className="font-mono text-[10px] text-[--color-teal] tracking-widest uppercase">ArtFact</span>
            <h2 id="terms-title" className="text-sm font-semibold text-[--color-foreground]">Política de Privacidade e Proteção de Dados</h2>
            <p className="font-mono text-[10px] text-[--color-muted]">Atualizado em 30 set. 2026 · Conforme LGPD (Lei 13.709/2018)</p>
          </div>
          <button onClick={onClose} className="text-[--color-muted] hover:text-white transition-colors text-lg leading-none ml-4 shrink-0" aria-label="Fechar">✕</button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {LGPD_SECTIONS.map((s) => (
            <div key={s.title} className="space-y-1.5">
              <h3 className="font-mono text-[11px] text-[--color-teal] tracking-widest uppercase">{s.title}</h3>
              <p className="text-xs text-[--color-muted] leading-relaxed" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{s.text}</p>
            </div>
          ))}
          <div className="pt-2 border-t border-[--color-border]">
            <p className="font-mono text-[10px] text-[--color-subtle] text-center">
              ArtFact — Verificação Científica · privacidade@artfact.com.br
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Login Modal ──────────────────────────────────────────────
function LoginModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const login = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try { await loginWithGoogle(); onClose() }
    catch (e) { setError(authErrorMessage(e)) }
    finally { setPending(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <div className="max-w-md rounded-lg p-6 bg-[--color-surface] border border-[--color-border] space-y-4">
      <h2 id="login-title" className="font-semibold">Entrar na ArtFact</h2>
      <p className="text-sm">Use sua conta Google. Na primeira entrada, seu usuário será criado automaticamente.</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button autoFocus disabled={pending} onClick={() => void login()} className="w-full px-4 py-3 rounded bg-white text-black disabled:opacity-50">{pending ? 'Aguardando Google…' : 'Entrar com Google'}</button>
      <button disabled={pending} onClick={onClose} className="text-sm underline">Continuar sem conta</button>
    </div>
  </div>
}

// ── Login Banner ──────────────────────────────────────────────
function LoginBanner({ onLogin, onDismiss }: { onLogin: () => void; onDismiss: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border animate-slide-up flex-wrap"
      style={{ borderColor: '#f5a623', background: '#f5a62310' }}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[--color-amber] text-base">⚠</span>
        <p className="text-xs text-[--color-foreground]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
          <span className="font-semibold">Você não está logado.</span> Este artigo será perdido ao sair da página.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onLogin}
          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[--color-teal] text-[--color-background] hover:bg-white hover:text-black transition-all duration-150"
          style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
        >
          Fazer login
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-md text-xs text-[--color-muted] hover:text-white transition-colors"
          aria-label="Dispensar"
        >✕</button>
      </div>
    </div>
  )
}

// ── Saved Articles Panel ──────────────────────────────────────
function SavedPanel({ articles, onClose }: { articles: AnalysisResult[]; onClose: () => void }) {
  const [activeArea, setActiveArea] = useState<string>('Todas')
  const verdictColor = {
    verified: 'var(--color-teal)',
    fake: 'var(--color-red)',
    uncertain: 'var(--color-amber)',
  }
  const verdictLabel = { verified: 'Compatível', fake: 'Divergente', uncertain: 'Inconclusivo' }

  const areas = ['Todas', ...Array.from(new Set(articles.map((a) => a.healthArea ?? 'Geral')))]
  const filtered = activeArea === 'Todas' ? articles : articles.filter((a) => (a.healthArea ?? 'Geral') === activeArea)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4"
      style={{ background: 'rgba(8,12,24,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-title"
    >
      <div
        className="w-full max-w-xs rounded-xl border bg-[--color-surface] flex flex-col animate-slide-up"
        style={{ borderColor: '#00d4aa', maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[--color-teal]" />
            <span id="saved-title" className="font-mono text-[11px] text-[--color-muted] tracking-widest uppercase">Artigos nesta sessão</span>
            {articles.length > 0 && (
              <span className="font-mono text-[10px] text-[--color-teal] border border-[--color-teal] rounded px-1">{articles.length}</span>
            )}
          </div>
          <button onClick={onClose} className="text-[--color-muted] hover:text-white transition-colors text-sm" aria-label="Fechar artigos salvos">✕</button>
        </div>

        {/* Area filters */}
        {articles.length > 0 && (
          <div className="px-4 py-3 border-b border-[--color-border] shrink-0">
            <p className="font-mono text-[9px] text-[--color-subtle] tracking-widest uppercase mb-2">Área de saúde</p>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((area) => {
                const cfg = area === 'Todas' ? null : HEALTH_AREAS[area]
                const isActive = activeArea === area
                return (
                  <button
                    key={area}
                    onClick={() => setActiveArea(area)}
                    aria-pressed={isActive}
                    className="health-area-badge px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide transition-all duration-150"
                    style={{
                      border: `1px solid ${isActive ? (cfg?.color ?? '#00d4aa') : 'var(--color-border)'}`,
                      background: isActive ? (cfg?.bg ?? '#00d4aa18') : 'transparent',
                      color: isActive ? (cfg?.color ?? '#00d4aa') : 'var(--color-muted)',
                    }}
                  >
                    {area}
                    {area !== 'Todas' && (
                      <span className="ml-1 opacity-70">
                        {articles.filter((a) => (a.healthArea ?? 'Geral') === area).length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Articles list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[--color-border]">
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <span className="font-mono text-3xl text-[--color-subtle]">⊡</span>
              <p className="text-xs text-[--color-muted] text-center font-mono">Nenhum artigo salvo ainda.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-[--color-muted] text-center py-10 font-mono">Sem artigos nesta área.</p>
          ) : filtered.map((a, i) => {
            const area = a.healthArea ?? 'Geral'
            const cfg = HEALTH_AREAS[area] ?? HEALTH_AREAS['Geral']
            return (
            <div key={i} className="px-5 py-4 space-y-2">
              {/* Area tag + verdict */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="health-area-badge font-mono text-[9px] tracking-widest uppercase rounded-full px-2 py-0.5"
                  style={{ color: cfg.color, background: cfg.bg }}
                >
                  {area}
                </span>
                <span
                  className="font-mono text-[9px] tracking-widest uppercase border rounded px-1.5 py-0.5"
                  style={{ color: verdictColor[a.overallVerdict], borderColor: verdictColor[a.overallVerdict] }}
                >
                  {verdictLabel[a.overallVerdict]}
                </span>
                <span className="font-mono text-[9px] text-[--color-subtle] ml-auto">Análise científica</span>
              </div>
              <p className="text-xs text-[--color-foreground] leading-snug line-clamp-2">{a.title}</p>
              <p className="font-mono text-[10px] text-[--color-muted]">{a.source}</p>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}

function AccessibilityMenu({
  settings,
  onChange,
}: {
  settings: AccessibilitySettings
  onChange: (settings: AccessibilitySettings) => void
}) {
  const [open, setOpen] = useState(false)
  const options: { key: 'highContrast' | 'reducedMotion'; label: string; description: string }[] = [
    { key: 'highContrast', label: 'Alto contraste', description: 'Recurso voltado para pessoas com baixa visão ou daltonismo' },
    { key: 'reducedMotion', label: 'Reduzir movimento', description: 'Desativa animações e transições' },
  ]
  const activeCount = Number(settings.highContrast) + Number(settings.textScale > 0) + Number(settings.reducedMotion)
  const textScalePercent = 100 + settings.textScale * 10

  return (
    <aside className="a11y-menu fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2" aria-label="Recursos de acessibilidade">
      {open && (
        <div
          id="accessibility-options"
          className="w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[--color-border-bright] p-4 shadow-2xl"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[--color-foreground]">Acessibilidade</h2>
              <p className="mt-1 text-xs leading-relaxed text-[--color-muted]">Ajuste a visualização conforme sua preferência.</p>
            </div>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => onChange({ highContrast: false, textScale: 0, reducedMotion: false })}
                className="a11y-reset rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-[--color-teal] hover:text-[--color-foreground]"
              >
                Redefinir
              </button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-[--color-border] px-3 py-2.5">
              <span>
                <span className="block text-xs font-semibold text-[--color-foreground]">Tamanho do texto</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-[--color-muted]">
                  Nível atual: {textScalePercent}%
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, textScale: Math.max(0, settings.textScale - 1) })}
                  disabled={settings.textScale === 0}
                  aria-label="Diminuir tamanho do texto"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[--color-border-bright] font-mono text-xs font-bold text-[--color-foreground] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, textScale: Math.min(3, settings.textScale + 1) })}
                  disabled={settings.textScale === 3}
                  aria-label="Aumentar tamanho do texto"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[--color-border-bright] font-mono text-sm font-bold text-[--color-foreground] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  A+
                </button>
              </span>
            </div>
            {options.map(({ key, label, description }) => {
              const active = settings[key]
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...settings, [key]: !active })}
                  className="accessibility-option flex w-full items-center justify-between gap-4 rounded-lg border border-[--color-border] px-3 py-2.5 text-left transition-colors hover:border-[--color-teal]"
                >
                  <span>
                    <span className="block text-xs font-semibold text-[--color-foreground]">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-[--color-muted]">{description}</span>
                  </span>
                  <span className="accessibility-toggle" aria-hidden="true">
                    <span className="accessibility-toggle-dot" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="accessibility-options"
        className="a11y-trigger relative flex h-12 items-center gap-2 rounded-full border border-[--color-teal] px-4 text-xs font-semibold text-[--color-foreground] shadow-xl transition-colors hover:bg-[--color-teal] hover:text-[--color-background]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="4.5" r="2.25" fill="currentColor" />
          <path d="M5 8.5c4.4 1.4 9.6 1.4 14 0M12 9.5V14m0 0-4 6m4-6 4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Acessibilidade
        {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[--color-teal] px-1 font-mono text-[9px] text-[--color-background]">{activeCount}</span>}
      </button>
    </aside>
  )
}

export default function App() {
  const [mode, setMode] = useState<VerifyMode>('url')
  const [url, setUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const [apiError, setApiError] = useState('')
  const [jobId, setJobId] = useState('')
  const [progress, setProgress] = useState(0)
  const [choices, setChoices] = useState<ExtractedClaim[]>([])
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => () => controller.current?.abort(), [])

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [savedArticles, setSavedArticles] = useState<AnalysisResult[]>([])
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(() => {
    const defaults = {
      highContrast: false,
      textScale: 0,
      reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
    try {
      const saved = localStorage.getItem('artfact-accessibility')
      if (!saved) return defaults
      const parsed = JSON.parse(saved)
      return {
        highContrast: Boolean(parsed.highContrast),
        textScale: typeof parsed.textScale === 'number'
          ? Math.min(3, Math.max(0, parsed.textScale))
          : parsed.largeText ? 1 : 0,
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
      }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('artfact-accessibility', JSON.stringify(accessibility))
    } catch {
      // The controls still work when browser storage is unavailable.
    }
  }, [accessibility])

  useEffect(() => onAuthStateChanged(auth, user => {
    setIsLoggedIn(Boolean(user))
    setUserName(user?.displayName || user?.email?.split('@')[0] || '')
    setSavedArticles([])
    setShowSaved(false)
    if (user) { setShowLoginModal(false); setShowBanner(false) }
  }, error => setApiError(authErrorMessage(error))), [])

  const handleLogout = async () => {
    try { await logout() }
    catch (error) { setApiError(authErrorMessage(error)) }
  }

  const receiveJob = (job: Job) => {
    if (job.status === 'AWAITING_CLAIM_SELECTION') {
      const items = extractedClaims(job)
      if (!items.length) throw new Error('O backend não extraiu alegações deste artigo.')
      setChoices(items)
      setSelected(items.slice(0, 10).map(c => c.claim_id))
      setStatus('selecting')
    } else {
      const data = mapResult(job)
      data.healthArea = detectHealthArea(data.title)
      setResult(data)
      if (auth.currentUser) setSavedArticles(prev => [data, ...prev.filter(item => item.analysisId !== data.analysisId)])
      setStatus('done')
    }
  }

  const runAnalysis = async (action: 'new' | 'select' | 'resume') => {
    if (busy.current) return
    busy.current = true
    const active = new AbortController()
    controller.current = active
    setApiError('')
    setStatus('loading')
    setProgress(0)
    try {
      let id = jobId
      if (action === 'new') {
        setResult(null)
        setChoices([])
        setJobId('')
        const job = await startAnalysis(url, mode === 'image' ? uploadedFile : null, active.signal)
        if (active.signal.aborted) return
        id = job.analysis_id
        setJobId(id)
      } else if (action === 'select') {
        await selectClaims(id, choices.filter(c => selected.includes(c.claim_id)), active.signal)
      }
      const job = await pollAnalysis(id, active.signal, j => setProgress(j.progress))
      if (!active.signal.aborted) receiveJob(job)
    } catch (error) {
      if (!active.signal.aborted) {
        setApiError(error instanceof Error ? error.message : 'Falha inesperada ao analisar.')
        setStatus('idle')
      }
    } finally {
      if (controller.current === active) busy.current = false
    }
  }
  const handleAnalyze = () => {
    if ((mode === 'url' && !url.trim()) || (mode === 'image' && !uploadedFile)) return
    void runAnalysis('new')
  }
  const stopPolling = () => {
    controller.current?.abort()
    controller.current = null
    busy.current = false
    setStatus('idle')
    setApiError('Consulta interrompida. O processamento pode continuar no servidor; use Retomar para consultar o resultado.')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setUploadedFile(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  const canAnalyze = mode === 'url' ? url.trim().length > 0 : uploadedFile !== null
  const accessibilityClasses = [
    accessibility.highContrast && 'a11y-high-contrast',
    accessibility.textScale > 0 && `a11y-text-scale-${accessibility.textScale}`,
    accessibility.reducedMotion && 'a11y-reduced-motion',
  ].filter(Boolean).join(' ')

  return (
    <div className={`min-h-screen bg-[--color-background] grid-bg scan-line ${accessibilityClasses}`}>
      <a href="#main-content" className="skip-link">Pular para o conteúdo principal</a>
      {/* Nav */}
      <header className="border-b border-[--color-border] bg-[--color-background] bg-opacity-90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ArtFact wordmark logo */}
          <div className="logo-mark cursor-pointer" style={{ lineHeight: 0 }}>
              <svg
                height="42"
                viewBox="0 0 142 76"
                fill="none"
                aria-label="ArtFact"
                style={{ width: 'auto' }}
              >
                {/* Magnifying glass — animates on hover */}
                <g className="logo-glass">
                  {/* Outer ring */}
                  <circle cx="36" cy="36" r="28" stroke="#00d4aa" strokeWidth="6"/>
                  {/* Handle */}
                  <line x1="57" y1="57" x2="75" y2="75" stroke="#00d4aa" strokeWidth="6" strokeLinecap="round"/>
                </g>
                {/* ART inside lens */}
                <text
                  x="36" y="42"
                  textAnchor="middle"
                  fontFamily="Instrument Sans, sans-serif"
                  fontWeight="700"
                  fontSize="15"
                  fill="#00d4aa"
                  className="logo-art"
                  letterSpacing="1"
                >
                  ART
                </text>
                {/* Fact outside lens */}
                <text
                  x="72" y="48"
                  fontFamily="Instrument Sans, sans-serif"
                  fontWeight="700"
                  fontSize="27"
                  fill="#dce6f5"
                  className="logo-fact"
                >
                  Fact
                </text>
              </svg>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#sobre" className="text-xs text-[--color-muted] px-3 py-1.5 rounded-md transition-all duration-150 hover:bg-white hover:text-black" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Sobre</a>
            <a href="#como" className="text-xs text-[--color-muted] px-3 py-1.5 rounded-md transition-all duration-150 hover:bg-white hover:text-black" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Como funciona</a>
            {isLoggedIn ? (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => setShowSaved(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[--color-border] text-xs text-[--color-muted] hover:border-[--color-teal] hover:text-[--color-teal] transition-all duration-150"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 1h8a1 1 0 011 1v9l-4.5-2.5L2 11V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  {savedArticles.length > 0 && (
                    <span className="font-mono text-[10px] text-[--color-teal]">{savedArticles.length}</span>
                  )}
                  Nesta sessão
                </button>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[--color-surface] border border-[--color-border]">
                  <div className="w-5 h-5 rounded-full bg-[--color-teal] flex items-center justify-center">
                    <span className="font-mono text-[9px] font-bold text-[--color-background]">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-[--color-foreground] max-w-[80px] truncate" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{userName}</span>
                </div>
                <button onClick={() => void handleLogout()} className="text-xs underline">Sair</button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="ml-2 px-3 py-1.5 rounded-md text-xs font-semibold border border-[--color-teal] text-[--color-teal] hover:border-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#080c18] transition-all duration-150"
                style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
              >
                Entrar
              </button>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-14 pb-24">
        {/* Hero */}
        <div className="mb-12 space-y-3">
          <div className="font-mono text-[11px] text-[--color-teal] tracking-widest uppercase mb-4">
            Verificador de artigos científicos 
          </div>
        <h1
          className="text-4xl leading-tight text-[--color-foreground]"
          style={{ fontFamily: "'Special Elite', cursive" }}
        >

          <br />
          <span className="typewriter-line-delay text-[--color-teal]">
            Busque por um artigo e verifique a qualidade das evidências
          </span>
        </h1>
        </div>

        {/* Input card */}
        <div className="verification-card border border-[--color-border] rounded-xl overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-[--color-border]">
            {(['url', 'image'] as VerifyMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setStatus('idle') }}
                aria-pressed={mode === m}
                className={`flex-1 py-3.5 font-mono text-xs tracking-widest uppercase transition-colors duration-150 ${
                  mode === m
                    ? 'text-[--color-teal] bg-[--color-teal-faint] border-b-2 border-[--color-teal]'
                    : 'text-[--color-muted] hover:text-[--color-foreground]'
                }`}
              >
                {m === 'url' ? '⌘  Link / URL' : '⊡  PDF / Imagem'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {mode === 'url' ? (
              <div className="space-y-3">
                <label htmlFor="article-url" className="font-mono text-[10px] text-[--color-muted] tracking-widest uppercase">
                  Link ou DOI do artigo
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-3 bg-[--color-background] border border-[--color-border] rounded-lg px-4 focus-within:border-[--color-teal] transition-colors duration-150">
                    <span className="text-[--color-muted] text-sm select-none">https://</span>
                    <input
                      id="article-url"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && canAnalyze && handleAnalyze()}
                      placeholder="https://pubmed.ncbi.nlm.nih.gov/... ou 10.xxxx/..."
                      className="min-w-0 flex-1 bg-transparent text-sm text-[--color-foreground] placeholder:text-[--color-subtle] outline-none py-3 font-mono"
                    />
                  </div>
                </div>
                <p className="text-xs text-[--color-muted]">
                  Compatível com PubMed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="article-image" className="font-mono text-[10px] text-[--color-muted] tracking-widest uppercase">
                  PDF ou imagem do artigo
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileRef.current?.click()
                    }
                  }}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? 'border-[--color-teal] bg-[--color-teal-faint]'
                      : uploadedFile
                      ? 'border-[--color-teal] bg-[--color-teal-faint]'
                      : 'border-[--color-border] hover:border-[--color-border-bright] bg-[--color-background]'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={uploadedFile ? `Arquivo selecionado: ${uploadedFile.name}. Ativar para substituir.` : 'Selecionar imagem do artigo'}
                >
                  {uploadedFile ? (
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-[--color-teal] tracking-wide">✓ Arquivo carregado</div>
                      <div className="text-sm text-[--color-foreground]">{uploadedFile.name}</div>
                      <div className="font-mono text-[10px] text-[--color-muted]">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-3xl text-[--color-subtle]">⊡</div>
                      <div className="text-sm text-[--color-muted]">
                        Arraste um print aqui ou <span className="text-[--color-teal]">clique para selecionar</span>
                      </div>
                      <div className="font-mono text-[10px] text-[--color-subtle]">PDF, PNG, JPG, WEBP — máx. 25 MB</div>
                    </div>
                  )}
                </div>
                <input
                  id="article-image"
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || status === 'loading'}
              className={`w-full py-3.5 rounded-lg text-sm tracking-wide transition-all duration-150 ${
                canAnalyze && status !== 'loading'
                  ? 'bg-[--color-teal] text-[--color-background] hover:bg-white hover:text-black active:scale-[0.99]'
                  : 'bg-[--color-border] text-[--color-subtle] cursor-not-allowed'
              }`}
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 }}
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[--color-background] border-t-transparent rounded-full animate-spin" />
                  Analisando...
                </span>
              ) : (
                'Verificar Agora'
              )}
            </button>
          </div>
        </div>

        {apiError && <div role="alert" className="mt-5 p-4 rounded-lg border border-red-400 text-sm">{apiError}
          {jobId && <button onClick={() => void runAnalysis('resume')} disabled={status === 'loading'} className="ml-3 underline">Retomar</button>}
        </div>}
        {status === 'loading' && <button onClick={stopPolling} className="mt-4 text-sm underline">Interromper consulta</button>}
        {status === 'selecting' && <section className="mt-6 p-5 rounded-lg border border-[--color-border] space-y-4">
          <h2 className="font-semibold">Selecione as alegações para pesquisar</h2>
          <p className="text-sm text-[--color-muted]">Revise o texto extraído e escolha até 10 alegações para comparar com a literatura.</p>
          {choices.map(c => <label key={c.claim_id} className="flex gap-3 items-start text-sm">
            <input type="checkbox" checked={selected.includes(c.claim_id)}
              disabled={!selected.includes(c.claim_id) && selected.length >= 10}
              onChange={e => setSelected(prev => e.target.checked ? [...prev, c.claim_id] : prev.filter(id => id !== c.claim_id))} />
            <span>{c.text}</span>
          </label>)}
          <button disabled={!selected.length} onClick={() => void runAnalysis('select')} className="px-4 py-3 rounded-lg bg-teal-400 text-black disabled:opacity-40">Pesquisar {selected.length} alegação(ões)</button>
        </section>}
        {/* Loading skeleton */}
        {status === 'loading' && (
          <div className="mt-10 space-y-4 animate-slide-up" role="status" aria-live="polite">
            <div className="border border-[--color-border] rounded-lg p-5 bg-[--color-surface] space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[--color-teal] animate-pulse" />
                <span className="font-mono text-[11px] text-[--color-teal] tracking-widest">PROCESSANDO ARTIGO · {Number.isFinite(progress) ? progress : 0}%</span>
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shimmer h-4 rounded w-full" style={{ width: `${70 + Math.random() * 30}%` }} />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {status === 'done' && result && <AnalysisCard result={result} />}

        {/* Login banner */}
        {showBanner && !isLoggedIn && status === 'done' && (
          <div className="mt-4">
            <LoginBanner
              onLogin={() => { setShowBanner(false); setShowLoginModal(true) }}
              onDismiss={() => setShowBanner(false)}
            />
          </div>
        )}

        {/* Sobre a Plataforma */}
        <section id="sobre" className="mt-16 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[--color-border]" />
        <span className="tracking-widest uppercase text-[26px]" style={{ fontFamily: '"Special Elite", cursive' }}>
          Sobre Nós
        </span>
            <div className="flex-1 h-px bg-[--color-border]" />
          </div>

          <div
            className="relative rounded-xl overflow-hidden border"
            style={{ borderColor: '#00d4aa', background: '#0f1526' }}
          >
            <div className="flex flex-col sm:flex-row min-h-[220px]">
              {/* Text side */}
              <div className="flex-1 flex flex-col justify-center gap-5 p-8 sm:pr-6 relative z-10">
                <div
                  className="about-accent absolute left-0 top-6 bottom-6 w-[3px] rounded-r"
                  style={{ background: '#00d4aa' }}
                />
                <p
                  className="text-sm font-normal leading-relaxed"
                  style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Verificamos a confiabilidade de artigos, notícias e afirmações científicas utilizando evidências provenientes de bases acadêmicas.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="font-mono text-[10px] tracking-widest uppercase"
                    style={{ color: '#6b7fa3' }}
                  >
                  </span>
                </div>
              </div>

              {/* Photo side */}
              <div className="about-image relative sm:w-[45%] h-52 sm:h-auto overflow-hidden">
                <div
                  className="hidden sm:block absolute inset-y-0 left-0 w-20 z-10 pointer-events-none"
                  style={{ background: 'linear-gradient(to right, #0f1526, transparent)' }}
                />
                <div
                  className="sm:hidden absolute inset-x-0 top-0 h-12 z-10 pointer-events-none"
                  style={{ background: 'linear-gradient(to bottom, #0f1526, transparent)' }}
                />
                <img
                  src="https://images.unsplash.com/photo-1766297247924-6638d54e7c89?w=600&h=440&fit=crop&auto=format"
                  alt="Dois cientistas analisando dados em computadores dentro de um laboratório"
                  className="w-full h-full object-cover opacity-80"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="como" className="mt-24 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[--color-border]" />
            <span className="tracking-widest uppercase text-[26px]" style={{ fontFamily: '"Special Elite", cursive' }}>
              Como Funciona
            </span>
            <div className="flex-1 h-px bg-[--color-border]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-stretch">
            {[
              {
                step: '01',
                title: 'Entrada',
                desc: 'Cole o URL ou envie um print do artigo que você quer verificar.',
                frontColor: '#4d9fff', 
                backBg: '#111112',     
                backBorder: '#111112', 
                backText: '#f7f8fa',   
              },
              {
                step: '02',
                title: 'Análise',
                desc: 'Cada afirmação é confrontada com literatura científica indexada e bases de fatos.',
                frontColor: '#00d4aa',
                backBg: '#111112',
                backBorder: '#111112',
                backText: '#f7f8fa',
              },
              {
                step: '03',
                title: 'Veredito',
                desc: 'Compare as alegações com a literatura e consulte alertas, limitações e fontes originais.',
                frontColor: '#f5a623',
                backBg: '#111112',
                backBorder: '#111112',
                backText: '#f7f8fa',
              },
            ].map(({ step, title, desc, frontColor, backBg, backBorder, backText }) => (
              <div
                key={step}
                tabIndex={0}
                aria-label={`${step} — ${title}: ${desc}`}
                className="flip-card group rounded-lg outline-none"
                style={{ height: 160 }}
              >
                <div className="flip-card-inner w-full h-full">
                  {/* Front */}
                  <div
                    className="process-card-face flip-card-front rounded-lg border border-[--color-border] flex flex-col items-center justify-center gap-2"
                    style={{ boxShadow: 'rgba(0,0,0,0.25) 0px 4px 4px 0px' }}
                  >
                    <div className="font-mono text-3xl font-semibold" style={{ color: frontColor }}>
                      {step}
                    </div>
                    <div
                      className="font-mono text-[11px] font-semibold tracking-widest uppercase"
                      style={{ color: frontColor }}
                    >
                      {title}
                    </div>
                  </div>
                  {/* Back */}
                  <div
                    className="process-card-face flip-card-back rounded-lg border flex flex-col items-center justify-center p-5 text-center"
                    style={{
                      background: backBg,
                      borderColor: backBorder,
                      boxShadow: 'rgba(0,0,0,0.25) 0px 4px 4px 0px',
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: backText, fontFamily: "'Lora', Georgia, serif", fontWeight: 500 }}>
                      {desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Academic Bases */}
        <section id="academic-bases" className="mt-16 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[--color-border]" />
            <span className="tracking-widest uppercase text-[26px]" style={{ fontFamily: '"Special Elite", cursive' }}>
              Base Acadêmica Consultada
            </span>
            <div className="flex-1 h-px bg-[--color-border]" />
          </div>

          <div
            className="grid grid-cols-1 gap-6 rounded-xl border border-[--color-border] bg-[--color-surface] p-6 sm:grid-cols-[260px_1fr] sm:items-center sm:p-8"
            style={{ backgroundColor: 'var(--color-surface)', opacity: 1 }}
          >
            <div className="flex min-h-36 items-center justify-center rounded-xl bg-[--color-background] p-4 text-center">
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Acessar o PubMed em uma nova aba"
                className="pubmed-logo-link inline-flex min-h-24 w-full items-center justify-center rounded-lg p-2 transition-transform duration-200 hover:scale-105"
              >
                <img
                  src={pubmedGovLogo}
                  alt="Logo PubMed.gov"
                  className="pubmed-logo h-auto w-full max-w-full object-contain"
                />
              </a>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#ffffff", fontFamily: "'Lora', Georgia, serif", fontWeight: 500 }}>
              Mantido pelos <strong className="font-semibold text-[--color-teal]">National Institutes of Health (NIH/EUA)</strong>, o <strong className="font-semibold text-[--color-teal]">PubMed</strong> é a referência global para busca e validação de <strong className="font-semibold text-[--color-teal]">evidências científicas</strong> na área da saúde. A base reúne literatura <strong className="font-semibold text-[--color-teal]">revisada por pares (peer-reviewed)</strong>, garantindo rigor metodológico através do índice <strong className="font-semibold text-[--color-teal]">MEDLINE</strong> e fornecendo rastreabilidade completa por meio de identificadores padronizados como <strong className="font-semibold text-[--color-teal]">PMID</strong> (PubMed Unique Identifier) e <strong className="font-semibold text-[--color-teal]">DOI</strong>.
            </p>
          </div>
        </section>

        {/* Stats bar */}


      </main>

      {/* Footer */}
      <footer className="border-t border-[--color-border] py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center justify-center gap-3 text-center">
          <span className="font-mono text-[11px] text-[--color-muted]">
            © 2026 ArtFact — Verificação científica independente
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTermsModal(true)}
              className="font-mono text-[11px] text-[--color-muted] px-3 py-1.5 rounded-md transition-all duration-150 hover:bg-white hover:text-black"
            >
              Privacidade
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
        />
      )}
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
      {showSaved && (
        <SavedPanel
          articles={savedArticles}
          onClose={() => setShowSaved(false)}
        />
      )}
      <AccessibilityMenu settings={accessibility} onChange={setAccessibility} />
    </div>
  )
}
