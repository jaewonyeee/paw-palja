import { useState, useEffect, useCallback, useRef, Component } from 'react'
import { motion } from 'motion/react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Database, Settings,
  Search, ChevronLeft, ChevronRight, X, Trash2, Eye, RefreshCw,
  Brain, FileText, Image, Activity, DollarSign, Zap, AlertTriangle
} from 'lucide-react'

// Panel-level error boundary to isolate crashes
class PanelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('[PanelError]', error, errorInfo)
  }
  componentDidUpdate(prevProps) {
    if (prevProps.panelKey !== this.props.panelKey) {
      this.setState({ hasError: false, error: null })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <AlertTriangle size={32} style={{ color: '#e74c3c', marginBottom: 12 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>패널 로드 오류</h3>
          <pre style={{ fontSize: '0.72rem', background: '#f5f5f5', padding: 12, borderRadius: 8, textAlign: 'left', overflow: 'auto', maxHeight: 150 }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 12, padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--bg-purple)', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Pagination component
function Pagination({ page, pages, onPageChange }) {
  const { t } = useTranslation()
  if (pages <= 1) return null
  return (
    <div style={s.pagination}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{ ...s.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
      >
        <ChevronLeft size={14} /> {t('admin.previous')}
      </button>
      <span style={s.pageInfo}>
        {t('admin.page')} {page} / {pages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        style={{ ...s.pageBtn, opacity: page >= pages ? 0.4 : 1 }}
      >
        {t('admin.next')} <ChevronRight size={14} />
      </button>
    </div>
  )
}

// Confirm modal
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.modalTitle}>{title}</h3>
        <p style={s.modalMsg}>{message}</p>
        <div style={s.modalActions}>
          <button onClick={onCancel} style={s.modalCancelBtn}>{t('common.cancel')}</button>
          <button onClick={onConfirm} style={s.modalConfirmBtn}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  )
}

// Detail modal
function DetailModal({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.detailModalBox} onClick={(e) => e.stopPropagation()}>
        <div style={s.detailModalHeader}>
          <h3 style={s.modalTitle}>{title}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </div>
        <div style={s.detailModalContent}>{children}</div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color }) {
  return (
    <div style={s.statCard}>
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span style={{ ...s.statNum, color: color || 'var(--text-primary)' }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )
}

// --- KPI Bar ---
function KpiBar({ t }) {
  const [kpi, setKpi] = useState(null)

  const fetchKpi = useCallback(async () => {
    try { setKpi(await api.adminKpiSummary()) } catch {}
  }, [])

  useEffect(() => {
    fetchKpi()
    const interval = setInterval(fetchKpi, 30000)
    return () => clearInterval(interval)
  }, [fetchKpi])

  if (!kpi) return null

  return (
    <div style={s.kpiBar}>
      <KpiItem icon={<DollarSign size={14}/>} label={t('admin.costToday')} value={`$${Number(kpi.cost_today || 0).toFixed(2)}`} />
      <KpiItem icon={<DollarSign size={14}/>} label={t('admin.costMonth')} value={`$${Number(kpi.cost_month || 0).toFixed(2)}`} />
      <KpiItem icon={<Zap size={14}/>} label={t('admin.tokensToday')} value={Number(kpi.tokens_today || 0).toLocaleString()} />
      <KpiItem icon={<Users size={14}/>} label={t('admin.activeUsers')} value={kpi.active_users || 0} />
      <KpiItem icon={<Activity size={14}/>} label={t('admin.avgLatency')} value={`${Math.round(Number(kpi.avg_latency_ms || 0))}ms`} />
      <KpiItem icon={<AlertTriangle size={14}/>} label={t('admin.errorRate')} value={`${Number(kpi.error_rate || 0).toFixed(1)}%`} color={Number(kpi.error_rate) > 5 ? '#e74c3c' : undefined} />
    </div>
  )
}

function KpiItem({ icon, label, value, color }) {
  return (
    <div style={s.kpiItem}>
      <span style={{ color: color || 'var(--bg-purple)' }}>{icon}</span>
      <span style={s.kpiValue}>{value}</span>
      <span style={s.kpiLabel}>{label}</span>
    </div>
  )
}

// --- Dashboard Panel ---
function DashboardPanel({ stats, system, t }) {
  const [apiUsage, setApiUsage] = useState(null)

  useEffect(() => {
    api.adminApiUsage('today').then(setApiUsage).catch(() => {})
  }, [])

  if (!stats) return <Spinner />
  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.dashboard')}</h2>
      <div style={s.statGrid}>
        <StatCard icon="👥" value={stats.total_users} label={t('admin.totalUsers')} />
        <StatCard icon="📖" value={stats.total_diaries} label={t('admin.totalDiaries')} />
        <StatCard icon="🤖" value={system?.agents?.length || 3} label={t('admin.agents')} />
        <StatCard icon="💬" value={system?.comment_personas?.length || 5} label="Comment Bots" />
      </div>

      {/* Today/Week/Month stats */}
      {apiUsage && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>{t('admin.apiUsage')} — {t('admin.today')}</h4>
          <div style={s.statGrid}>
            <StatCard icon="📡" value={apiUsage.total_calls} label={t('admin.apiCalls')} />
            <StatCard icon="🎯" value={`${apiUsage.success_rate}%`} label={t('admin.successRate')} />
            <StatCard icon="🔤" value={(apiUsage.total_tokens || 0).toLocaleString()} label={t('admin.totalTokens')} />
            <StatCard icon="💰" value={`$${apiUsage.total_cost_usd}`} label={t('admin.estimatedCost')} />
          </div>
        </div>
      )}

      {/* Recent errors */}
      {apiUsage?.recent_errors?.length > 0 && (
        <div style={{ ...s.card, marginTop: 14 }}>
          <h4 style={s.cardTitle}>{t('admin.recentErrors')}</h4>
          {apiUsage.recent_errors.slice(0, 5).map((e, i) => (
            <div key={i} style={s.miniCard}>
              <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{e.endpoint}</div>
              <div style={{ fontSize: '0.72rem', color: '#e74c3c' }}>{e.error}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{e.created_at?.slice(0, 19)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- LLM & Agents Panel ---
function LlmAgentsPanel({ t }) {
  const [perf, setPerf] = useState(null)
  const [mcpStats, setMcpStats] = useState(null)
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.adminAgentPerformance(period),
      api.adminMcpStats(),
    ]).then(([p, m]) => { setPerf(p); setMcpStats(m) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <Spinner />

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.llmAgents')}</h2>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['today', 'week', 'month'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{ ...s.periodBtn, ...(period === p ? s.periodBtnActive : {}) }}
          >
            {t(`admin.${p === 'today' ? 'today' : p === 'week' ? 'thisWeek' : 'thisMonth'}`)}
          </button>
        ))}
      </div>

      {/* Agent performance cards */}
      {perf?.agents && (
        <div style={s.statGrid}>
          {perf.agents.map((agent) => (
            <div key={agent.name} style={{ ...s.card, padding: '16px 18px' }}>
              <h4 style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain size={16} style={{ color: 'var(--bg-purple)' }} />
                {agent.name}
              </h4>
              <div style={s.kvRow}><span style={s.kvLabel}>Calls</span><span style={s.kvValue}>{agent.call_count || 0}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Errors</span><span style={{ ...s.kvValue, color: (agent.error_count || 0) > 0 ? '#e74c3c' : undefined }}>{agent.error_count || 0}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Avg Duration</span><span style={s.kvValue}>{agent.avg_duration || '—'}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Tokens</span><span style={s.kvValue}>{(agent.total_tokens || 0).toLocaleString()}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Cost</span><span style={s.kvValue}>${(agent.total_cost || 0).toFixed(4)}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Comment persona stats */}
      {perf?.comment_personas && perf.comment_personas.length > 0 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>Comment Persona Stats</h4>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Persona</th>
                  <th style={s.th}>Calls</th>
                  <th style={s.th}>Avg Duration</th>
                  <th style={s.th}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {perf.comment_personas.map((cp) => (
                  <tr key={cp.name}>
                    <td style={s.td}>{cp.name}</td>
                    <td style={s.td}>{cp.call_count || 0}</td>
                    <td style={s.td}>{cp.avg_duration || '—'}</td>
                    <td style={s.td}>{(cp.total_tokens || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MCP Tools table */}
      {mcpStats?.tools && mcpStats.tools.length > 0 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>MCP Tools</h4>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Tool</th>
                  <th style={s.th}>Usage</th>
                  <th style={s.th}>Errors</th>
                  <th style={s.th}>Category</th>
                </tr>
              </thead>
              <tbody>
                {mcpStats.tools.map((tool) => (
                  <tr key={tool.name}>
                    <td style={s.td}>{tool.name}</td>
                    <td style={s.td}>{tool.usage_count || 0}</td>
                    <td style={{ ...s.td, color: (tool.error_count || 0) > 0 ? '#e74c3c' : undefined }}>{tool.error_count || 0}</td>
                    <td style={s.td}>{tool.category || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model usage breakdown */}
      {perf?.model_usage && perf.model_usage.length > 0 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>Model Usage</h4>
          {perf.model_usage.map((m) => (
            <div key={m.model} style={s.kvRow}>
              <span style={s.kvLabel}>{m.model}</span>
              <span style={s.kvValue}>{m.count} calls — ${(m.cost || 0).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Prompts Panel ---
function PromptsPanel({ t }) {
  const [prompts, setPrompts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(null)
  const [collapsed, setCollapsed] = useState({})

  const fetchPrompts = async () => {
    try {
      const res = await api.adminPrompts()
      const list = Array.isArray(res) ? res : (res && res.prompts) ? res.prompts : []
      // Ensure each prompt has required fields
      setPrompts(list.map(p => ({
        key: p.key || '',
        value: p.value ?? '',
        type: p.type || 'text',
        description: p.description || p.key || '',
        is_overridden: !!p.is_overridden,
        default_value: p.default_value ?? '',
      })))
    } catch (err) {
      console.error('[PromptsPanel] fetchPrompts failed:', err)
      setPrompts([])
    }
    setLoading(false)
  }
  useEffect(() => { fetchPrompts() }, [])

  const startEdit = (key, currentValue) => {
    setEditingKey(key)
    setEditValue(currentValue)
  }

  const savePrompt = async (key) => {
    setSaving(true)
    try {
      const prompt = prompts.find(p => p.key === key)
      await api.adminUpdatePrompt(key, { value: editValue, config_type: prompt?.type || 'text' })
      await fetchPrompts()
      setEditingKey(null)
    } catch {}
    setSaving(false)
  }

  const resetPrompt = async (key) => {
    try {
      await api.adminResetPrompt(key)
      await fetchPrompts()
      setResetConfirm(null)
    } catch {}
  }

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <Spinner />
  if (!prompts || prompts.length === 0) {
    return (
      <div>
        <h2 style={s.panelTitle}>{t('admin.promptManagement')}</h2>
        <div style={s.card}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No prompts configured.</p>
        </div>
      </div>
    )
  }

  // Group prompts by category
  const temperatures = prompts.filter(p => p.key?.includes('temperature'))
  const systemPrompts = prompts.filter(p => p.key?.includes('system_prompt'))
  const personaConfigs = prompts.filter(p => p.key?.startsWith('persona.'))
  const commentConfigs = prompts.filter(p => p.key?.startsWith('comment.'))
  const otherPrompts = prompts.filter(p =>
    !p.key?.includes('temperature') &&
    !p.key?.includes('system_prompt') &&
    !p.key?.startsWith('persona.') &&
    !p.key?.startsWith('comment.')
  )

  const renderPromptItem = (prompt, isTextarea = false) => {
    const isEditing = editingKey === prompt.key
    return (
      <div key={prompt.key} style={s.promptItem}>
        <div style={s.promptHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={s.promptLabel}>{prompt.description || prompt.key}</span>
            {prompt.is_overridden && <span style={s.modifiedBadge}>Modified</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {prompt.is_overridden && (
              <button onClick={() => setResetConfirm(prompt.key)} style={s.resetBtn}>Reset to Default</button>
            )}
            {isTextarea && !isEditing && (
              <button onClick={() => toggleCollapse(prompt.key)} style={s.collapseBtn}>
                {collapsed[prompt.key] ? 'Expand' : 'Collapse'}
              </button>
            )}
          </div>
        </div>

        {isTextarea ? (
          <>
            {!collapsed[prompt.key] && (
              isEditing ? (
                <div>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    style={s.promptTextarea}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => savePrompt(prompt.key)} disabled={saving} style={s.saveBtn}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingKey(null)} style={s.resetBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startEdit(prompt.key, prompt.value || prompt.default_value || '')}
                  style={{ ...s.promptTextarea, cursor: 'pointer', minHeight: 60, background: 'var(--bg-card)' }}
                >
                  {(prompt.value || prompt.default_value || '').slice(0, 300)}
                  {(prompt.value || prompt.default_value || '').length > 300 ? '...' : ''}
                </div>
              )
            )}
          </>
        ) : (
          isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                step={0.05}
                min={0}
                max={2}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={s.tempInput}
              />
              <button onClick={() => savePrompt(prompt.key)} disabled={saving} style={s.saveBtn}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingKey(null)} style={s.resetBtn}>Cancel</button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(prompt.key, prompt.value || prompt.default_value || '')}
              style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--bg-purple)' }}
            >
              {prompt.value || prompt.default_value || '—'}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.promptManagement')}</h2>

      {temperatures.length > 0 && (
        <div style={s.promptSection}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Temperature Settings</h3>
          {temperatures.map((p) => renderPromptItem(p, false))}
        </div>
      )}

      {systemPrompts.length > 0 && (
        <div style={s.promptSection}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>System Prompts</h3>
          {systemPrompts.map((p) => renderPromptItem(p, true))}
        </div>
      )}

      {personaConfigs.length > 0 && (
        <div style={s.promptSection}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Persona Config</h3>
          {personaConfigs.map((p) => renderPromptItem(p, true))}
        </div>
      )}

      {commentConfigs.length > 0 && (
        <div style={s.promptSection}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Comment Config</h3>
          {commentConfigs.map((p) => renderPromptItem(p, true))}
        </div>
      )}

      {otherPrompts.length > 0 && (
        <div style={s.promptSection}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Other</h3>
          {otherPrompts.map((p) => renderPromptItem(p, true))}
        </div>
      )}

      <ConfirmModal
        open={!!resetConfirm}
        title="Reset Prompt"
        message={`Reset "${resetConfirm}" to its default value?`}
        onConfirm={() => resetPrompt(resetConfirm)}
        onCancel={() => setResetConfirm(null)}
      />
    </div>
  )
}

// --- Users Panel ---
function UsersPanel({ t }) {
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const debouncedQuery = useDebounce(query, 300)

  const fetchUsers = useCallback(async (q, p) => {
    setLoading(true)
    try {
      const res = await api.adminUsers(q, p)
      setData(res)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers(debouncedQuery, 1); setPage(1) }, [debouncedQuery])
  useEffect(() => { fetchUsers(debouncedQuery, page) }, [page])

  const viewDetail = async (userId) => {
    try {
      const d = await api.adminUserDetail(userId)
      setDetail(d)
    } catch {}
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.adminDeleteUser(deleteTarget)
      setDeleteTarget(null)
      fetchUsers(debouncedQuery, page)
    } catch {}
  }

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.userManagement')}</h2>
      <div style={s.searchBar}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.searchPlaceholder')}
          style={s.searchInput}
        />
      </div>

      {loading ? <Spinner /> : data && (
        <>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>ID</th>
                  <th style={s.th}>{t('auth.nickname')}</th>
                  <th style={s.th}>{t('admin.diaries')}</th>
                  <th style={s.th}>{t('admin.joinedAt')}</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.user_id}>
                    <td style={s.td}>{u.user_id}</td>
                    <td style={s.td}>{u.nickname}</td>
                    <td style={s.td}>{u.diary_count}</td>
                    <td style={s.td}>{u.created_at?.slice(0, 10)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button onClick={() => viewDetail(u.user_id)} style={s.iconBtn} title="View">
                        <Eye size={14} />
                      </button>
                      {u.user_id !== 'admin' && (
                        <button onClick={() => setDeleteTarget(u.user_id)} style={{ ...s.iconBtn, color: '#e74c3c' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: 20 }}>{t('admin.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onPageChange={setPage} />
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t('admin.deleteUser')}
        message={t('admin.deleteUserConfirm', { userId: deleteTarget })}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <DetailModal
        open={!!detail}
        title={t('admin.userDetail')}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={s.detailRow}><span style={s.detailLabel}>ID:</span> {detail.user_id}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>{t('auth.nickname')}:</span> {detail.nickname}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>Email:</span> {detail.email || '-'}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>Bio:</span> {detail.bio || '-'}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>{t('admin.diaryCount')}:</span> {detail.diary_count}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>{t('admin.joinedAt')}:</span> {detail.created_at?.slice(0, 10)}</div>
            {detail.dog?.name && (
              <div style={s.detailRow}><span style={s.detailLabel}>Dog:</span> {detail.dog.name} · {detail.dog.breed} · {detail.dog.mbti}</div>
            )}
            {detail.recent_diaries?.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 8 }}>{t('admin.recentDiaries')}</h4>
                {detail.recent_diaries.map((d) => (
                  <div key={d.entry_id} style={s.miniCard}>
                    <span>{d.date}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.is_public ? '🌐' : '🔒'}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </DetailModal>
    </div>
  )
}

// --- Diaries Panel ---
function DiariesPanel({ t }) {
  const [query, setQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const debouncedQuery = useDebounce(query, 300)

  const fetchDiaries = useCallback(async (q, p) => {
    setLoading(true)
    try {
      const res = await api.adminDiaries({ q, user_id: userId, date_from: dateFrom, date_to: dateTo, page: p })
      setData(res)
    } catch {}
    setLoading(false)
  }, [userId, dateFrom, dateTo])

  useEffect(() => { fetchDiaries(debouncedQuery, 1); setPage(1) }, [debouncedQuery, userId, dateFrom, dateTo])
  useEffect(() => { fetchDiaries(debouncedQuery, page) }, [page])

  const viewDetail = async (entryId) => {
    try {
      const d = await api.adminDiaryDetail(entryId)
      setDetail(d)
    } catch {}
  }

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.diaryBrowser')}</h2>
      <div style={s.searchBar}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.searchDiaries')}
          style={s.searchInput}
        />
      </div>
      <div style={s.filterRow}>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('admin.filterByUser')}
          style={s.filterInput}
        />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={s.filterInput} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={s.filterInput} />
      </div>

      {loading ? <Spinner /> : data && (
        <>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('admin.diaryDate')}</th>
                  <th style={s.th}>{t('admin.diaryAuthor')}</th>
                  <th style={s.th}>Preview</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.entry_id}>
                    <td style={s.td}>{e.date}</td>
                    <td style={s.td}>{e.user_id}</td>
                    <td style={{ ...s.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.preview || '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button onClick={() => viewDetail(e.entry_id)} style={s.iconBtn}><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', padding: 20 }}>{t('admin.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onPageChange={setPage} />
        </>
      )}

      <DetailModal
        open={!!detail}
        title={t('admin.diaryDetail')}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={s.detailRow}><span style={s.detailLabel}>{t('admin.diaryDate')}:</span> {detail.date}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>{t('admin.diaryAuthor')}:</span> {detail.user_id}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>Public:</span> {detail.is_public ? 'Yes' : 'No'}</div>
            <div style={s.detailRow}><span style={s.detailLabel}>Views:</span> {detail.view_count || 0}</div>
            {detail.diary && (
              <div style={s.diaryContent}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>{t('admin.diaryContent')}</h4>
                <pre style={s.pre}>{JSON.stringify(detail.diary, null, 2)}</pre>
              </div>
            )}
            {detail.horoscope && (
              <div style={s.diaryContent}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Horoscope</h4>
                <pre style={s.pre}>{JSON.stringify(detail.horoscope, null, 2)}</pre>
              </div>
            )}
            {detail.comments?.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Comments ({detail.comments.length})</h4>
                {detail.comments.map((c, i) => (
                  <div key={i} style={s.miniCard}>
                    <span style={{ fontWeight: 600 }}>{c.persona || c.author}</span>: {c.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DetailModal>
    </div>
  )
}

// --- RAG Data Panel ---
function RagDataPanel({ t }) {
  const [ragStatus, setRagStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reindexing, setReindexing] = useState(false)

  useEffect(() => {
    api.adminRagStatus().then(setRagStatus).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleReindex = async () => {
    setReindexing(true)
    try {
      await api.adminRagReindex()
      const updated = await api.adminRagStatus()
      setRagStatus(updated)
    } catch {}
    setReindexing(false)
  }

  if (loading) return <Spinner />

  const maxDocs = ragStatus?.sources
    ? Math.max(...ragStatus.sources.map(src => src.doc_count || 0), 1)
    : 1

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.ragData')}</h2>

      {/* Collection overview */}
      <div style={s.statGrid}>
        <StatCard icon="📚" value={ragStatus?.total_docs || 0} label="Total Documents" />
        <StatCard icon="🗃️" value={ragStatus?.collection_count || 0} label="Collections" />
      </div>

      {/* Source breakdown */}
      {ragStatus?.sources && ragStatus.sources.length > 0 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>Source Breakdown</h4>
          {ragStatus.sources.map((src) => (
            <div key={src.name} style={s.barContainer}>
              <span style={s.barLabel}>{src.name}</span>
              <div style={s.bar}>
                <div
                  style={{
                    ...s.barFill,
                    width: `${Math.max(2, (src.doc_count / maxDocs) * 100)}%`,
                  }}
                />
              </div>
              <span style={s.barValue}>{src.doc_count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Directory size */}
      {ragStatus?.directory_size && (
        <div style={{ ...s.card, marginTop: 14 }}>
          <h4 style={s.cardTitle}>Storage</h4>
          <div style={s.kvRow}>
            <span style={s.kvLabel}>Directory Size</span>
            <span style={s.kvValue}>{ragStatus.directory_size}</span>
          </div>
        </div>
      )}

      {/* Reindex button */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          style={{
            ...s.saveBtn,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: reindexing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={reindexing ? { animation: 'spin 1s linear infinite' } : {}} />
          {reindexing ? 'Reindexing...' : 'Reindex All'}
        </button>
      </div>
    </div>
  )
}

// --- Images Panel ---
function ImagesPanel({ t }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.adminImageStats().then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const totalSizeMb = (stats?.total_size_bytes || 0) / (1024 * 1024)
  const WARN_THRESHOLD_MB = 500

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.imageData')}</h2>

      <div style={s.statGrid}>
        <StatCard icon="👤" value={stats?.profile_count || 0} label="Profile Images" />
        <StatCard icon="📷" value={stats?.diary_photo_count || 0} label="Diary Photos" />
        <StatCard icon="💾" value={`${totalSizeMb.toFixed(1)} MB`} label="Total Storage" />
      </div>

      {/* Size breakdowns */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <h4 style={s.cardTitle}>Storage Details</h4>
        <div style={s.kvRow}>
          <span style={s.kvLabel}>Profile Images</span>
          <span style={s.kvValue}>
            {stats?.profile_count || 0} files — {((stats?.profile_size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>
        <div style={s.kvRow}>
          <span style={s.kvLabel}>Diary Photos</span>
          <span style={s.kvValue}>
            {stats?.diary_photo_count || 0} files — {((stats?.diary_photo_size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>
      </div>

      {/* Warning if over threshold */}
      {totalSizeMb > WARN_THRESHOLD_MB && (
        <div style={s.warningBox}>
          <AlertTriangle size={16} style={{ color: '#e74c3c', flexShrink: 0 }} />
          <span style={s.warningText}>
            Storage usage ({totalSizeMb.toFixed(0)} MB) exceeds {WARN_THRESHOLD_MB} MB threshold.
          </span>
        </div>
      )}
    </div>
  )
}

// --- System Panel (enhanced) ---
function SystemPanel({ system, t }) {
  const [dbStatus, setDbStatus] = useState(null)
  const [apiUsage, setApiUsage] = useState(null)
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [db, usage] = await Promise.all([api.adminDbStatus(), api.adminApiUsage(period)])
      setDbStatus(db)
      setApiUsage(usage)
    } catch {}
    setLoading(false)
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  if (!system) return <Spinner />

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.system')}</h2>

      {/* Server info */}
      <div style={s.card}>
        <h4 style={s.cardTitle}>Server Info</h4>
        <div style={s.kvRow}><span style={s.kvLabel}>Version</span><span style={s.kvValue}>{system.version}</span></div>
        {system.llm_provider && (
          <div style={s.kvRow}><span style={s.kvLabel}>LLM Provider</span><span style={s.kvValue}>{system.llm_provider}</span></div>
        )}
      </div>

      <div style={{ ...s.card, marginTop: 14 }}>
        <h4 style={s.cardTitle}>AI Agents</h4>
        <div style={s.tagRow}>
          {system.agents.map((a) => <span key={a} style={s.tag}>{a}</span>)}
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 14 }}>
        <h4 style={s.cardTitle}>Comment Personas</h4>
        <div style={s.tagRow}>
          {system.comment_personas.map((p) => <span key={p} style={s.tag}>{p}</span>)}
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 14 }}>
        <h4 style={s.cardTitle}>Features</h4>
        <div style={s.tagRow}>
          {system.features.map((f) => (
            <span key={f} style={{ ...s.tag, background: 'rgba(108,92,231,0.08)', color: 'var(--bg-purple)' }}>{f}</span>
          ))}
        </div>
      </div>

      {/* DB Status */}
      {dbStatus && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h4 style={s.cardTitle}>{t('admin.dbStatus')}</h4>
          <div style={s.kvRow}><span style={s.kvLabel}>{t('admin.dbType')}</span><span style={s.kvValue}>{dbStatus.db_type}</span></div>
          {dbStatus.db_size && <div style={s.kvRow}><span style={s.kvLabel}>{t('admin.dbSize')}</span><span style={s.kvValue}>{dbStatus.db_size}</span></div>}
          <h4 style={{ ...s.cardTitle, marginTop: 12 }}>{t('admin.tableRows')}</h4>
          {Object.entries(dbStatus.tables || {}).map(([name, count]) => (
            <div key={name} style={s.kvRow}><span style={s.kvLabel}>{name}</span><span style={s.kvValue}>{count}</span></div>
          ))}
          {dbStatus.pool && (
            <>
              <h4 style={{ ...s.cardTitle, marginTop: 12 }}>{t('admin.connectionPool')}</h4>
              <div style={s.kvRow}><span style={s.kvLabel}>Pool Size</span><span style={s.kvValue}>{dbStatus.pool.size}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Checked In</span><span style={s.kvValue}>{dbStatus.pool.checked_in}</span></div>
              <div style={s.kvRow}><span style={s.kvLabel}>Checked Out</span><span style={s.kvValue}>{dbStatus.pool.checked_out}</span></div>
            </>
          )}
        </div>
      )}

      {/* API Usage */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={s.cardTitle}>{t('admin.apiUsage')}</h4>
          <div style={{ display: 'flex', gap: 6 }}>
            {['today', 'week', 'month'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{ ...s.periodBtn, ...(period === p ? s.periodBtnActive : {}) }}
              >
                {t(`admin.${p === 'today' ? 'today' : p === 'week' ? 'thisWeek' : 'thisMonth'}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Spinner /> : apiUsage && (
          <>
            <div style={s.statGrid}>
              <StatCard icon="📡" value={apiUsage.total_calls} label={t('admin.apiCalls')} />
              <StatCard icon="🎯" value={`${apiUsage.success_rate}%`} label={t('admin.successRate')} />
              <StatCard icon="🔤" value={(apiUsage.total_tokens || 0).toLocaleString()} label={t('admin.totalTokens')} />
              <StatCard icon="💰" value={`$${apiUsage.total_cost_usd}`} label={t('admin.estimatedCost')} />
            </div>

            {apiUsage.by_endpoint?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={s.cardTitle}>{t('admin.byEndpoint')}</h4>
                {apiUsage.by_endpoint.map((e) => (
                  <div key={e.endpoint} style={s.kvRow}>
                    <span style={s.kvLabel}>{e.endpoint}</span>
                    <span style={s.kvValue}>{e.count}</span>
                  </div>
                ))}
              </div>
            )}

            {apiUsage.by_model?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={s.cardTitle}>{t('admin.byModel')}</h4>
                {apiUsage.by_model.map((m) => (
                  <div key={m.model} style={s.kvRow}>
                    <span style={s.kvLabel}>{m.model}</span>
                    <span style={s.kvValue}>{m.count}</span>
                  </div>
                ))}
              </div>
            )}

            {apiUsage.recent_errors?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={s.cardTitle}>{t('admin.recentErrors')}</h4>
                {apiUsage.recent_errors.map((e, i) => (
                  <div key={i} style={s.miniCard}>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{e.endpoint}</div>
                    <div style={{ fontSize: '0.72rem', color: '#e74c3c' }}>{e.error}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{e.created_at?.slice(0, 19)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


// --- Main Admin Component ---
const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'admin.dashboard' },
  { id: 'llm', icon: Brain, labelKey: 'admin.llmAgents' },
  { id: 'prompts', icon: FileText, labelKey: 'admin.promptManagement' },
  { id: 'users', icon: Users, labelKey: 'admin.userManagement' },
  { id: 'diaries', icon: BookOpen, labelKey: 'admin.diaryBrowser' },
  { id: 'rag', icon: Database, labelKey: 'admin.ragData' },
  { id: 'images', icon: Image, labelKey: 'admin.imageData' },
  { id: 'system', icon: Settings, labelKey: 'admin.system' },
]

export default function Admin() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [system, setSystem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState('dashboard')

  useEffect(() => {
    if (user?.user_id !== 'admin') return
    Promise.all([api.adminStats(), api.adminSystem()])
      .then(([st, sys]) => { setStats(st); setSystem(sys) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (user?.user_id !== 'admin') return <Navigate to="/home" replace />

  if (loading) {
    return (
      <motion.div {...pageTransition} className="admin-dashboard" style={s.loading}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageTransition} className="admin-dashboard" style={s.root}>
      {/* Sidebar (desktop) */}
      <nav style={s.sidebar} className="admin-sidebar">
        <div style={s.sidebarHeader}>
          <h3 style={s.sidebarTitle}>{t('admin.title')}</h3>
        </div>
        <div style={s.navList}>
          {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              style={{ ...s.navItem, ...(activePanel === id ? s.navItemActive : {}) }}
            >
              <Icon size={18} />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/profile')} style={s.backBtn}>
          <ChevronLeft size={16} /> {t('common.back')}
        </button>
      </nav>

      {/* Mobile top nav */}
      <nav style={s.mobileNav} className="admin-mobile-nav">
        <div style={s.mobileNavScroll}>
          {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              style={{ ...s.mobileNavItem, ...(activePanel === id ? s.mobileNavItemActive : {}) }}
            >
              <Icon size={16} />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main style={s.main}>
        <KpiBar t={t} />
        <PanelErrorBoundary panelKey={activePanel}>
          {activePanel === 'dashboard' && <DashboardPanel stats={stats} system={system} t={t} />}
          {activePanel === 'llm' && <LlmAgentsPanel t={t} />}
          {activePanel === 'prompts' && <PromptsPanel t={t} />}
          {activePanel === 'users' && <UsersPanel t={t} />}
          {activePanel === 'diaries' && <DiariesPanel t={t} />}
          {activePanel === 'rag' && <RagDataPanel t={t} />}
          {activePanel === 'images' && <ImagesPanel t={t} />}
          {activePanel === 'system' && <SystemPanel system={system} t={t} />}
        </PanelErrorBoundary>
      </main>
    </motion.div>
  )
}


// --- Styles ---
const s = {
  root: {
    display: 'flex',
    height: '100%',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  loading: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
  },

  // Sidebar
  sidebar: {
    width: 240,
    background: 'white',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  sidebarTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--bg-purple)',
  },
  navList: {
    flex: 1,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    width: '100%',
  },
  navItemActive: {
    background: 'rgba(108,92,231,0.08)',
    color: 'var(--bg-purple)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '14px 20px',
    borderTop: '1px solid var(--border-light)',
    border: 'none',
    borderTopStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: 'var(--border-light)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Mobile nav
  mobileNav: {
    display: 'none',
    borderBottom: '1px solid var(--border-light)',
    background: 'white',
  },
  mobileNavScroll: {
    display: 'flex',
    overflowX: 'auto',
    padding: '0 8px',
    gap: 0,
  },
  mobileNavItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid transparent',
  },
  mobileNavItemActive: {
    color: 'var(--bg-purple)',
    borderBottomColor: 'var(--bg-purple)',
  },

  // Main content
  main: {
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // Panel
  panelTitle: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: 20,
  },

  // Stat grid
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '20px 16px',
    border: '1.5px solid var(--border-card)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  statNum: {
    fontSize: '1.8rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  statLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },

  // Card
  card: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '16px 18px',
    border: '1px solid var(--border-light)',
  },
  cardTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 10,
  },

  // KV rows
  kvRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--border-light)',
  },
  kvLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  kvValue: {
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },

  // Tags
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
  },

  // Breakdown
  breakdownRow: { display: 'flex', justifyContent: 'space-around', gap: 8 },
  breakdownItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  breakdownNum: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--bg-purple)' },
  breakdownLabel: { fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' },

  // Search
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-card)',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    background: 'transparent',
    color: 'var(--text-primary)',
  },

  // Filters
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterInput: {
    padding: '8px 12px',
    border: '1.5px solid var(--border-card)',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    background: 'white',
    color: 'var(--text-primary)',
    outline: 'none',
    minWidth: 120,
  },

  // Table
  tableWrap: {
    overflowX: 'auto',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: '1px solid var(--border-light)',
    background: 'var(--bg-card)',
  },
  td: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border-light)',
  },

  // Buttons
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
  },

  // Period selector
  periodBtn: {
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid var(--border-card)',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  periodBtnActive: {
    background: 'var(--bg-purple)',
    color: 'white',
    borderColor: 'var(--bg-purple)',
  },

  // Pagination
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-card)',
    background: 'white',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  pageInfo: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBox: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: 8,
  },
  modalMsg: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: 20,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--border-card)',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  modalConfirmBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#e74c3c',
    color: 'white',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Detail modal
  detailModalBox: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    maxWidth: 600,
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  detailModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-light)',
  },
  detailModalContent: {
    padding: '20px',
    overflowY: 'auto',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 4,
  },
  detailRow: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  detailLabel: {
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginRight: 6,
  },

  // Mini card
  miniCard: {
    padding: '8px 12px',
    background: 'var(--bg-card)',
    borderRadius: 8,
    marginBottom: 6,
    fontSize: '0.8rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Diary content
  diaryContent: {
    background: 'var(--bg-card)',
    borderRadius: 10,
    padding: '12px 14px',
  },
  pre: {
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: 200,
    overflowY: 'auto',
    color: 'var(--text-secondary)',
  },

  // KPI Bar
  kpiBar: {
    display: 'flex',
    gap: 16,
    padding: '12px 20px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-card)',
    marginBottom: 20,
    overflowX: 'auto',
    flexWrap: 'wrap',
  },
  kpiItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    minWidth: 'fit-content',
  },
  kpiValue: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  kpiLabel: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },

  // Prompt editing
  promptSection: {
    marginBottom: 20,
  },
  promptItem: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
    padding: '14px 18px',
    marginBottom: 8,
  },
  promptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promptLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  modifiedBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(108,92,231,0.1)',
    color: 'var(--bg-purple)',
  },
  tempInput: {
    width: 80,
    padding: '6px 10px',
    border: '1.5px solid var(--border-card)',
    borderRadius: 8,
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 700,
    textAlign: 'center',
    outline: 'none',
  },
  promptTextarea: {
    width: '100%',
    minHeight: 100,
    padding: '10px 14px',
    border: '1.5px solid var(--border-card)',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  },
  saveBtn: {
    padding: '6px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--bg-purple)',
    color: 'white',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resetBtn: {
    padding: '6px 16px',
    borderRadius: 8,
    border: '1px solid var(--border-card)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // RAG bars
  barContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
  },
  barLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    width: 100,
    textAlign: 'right',
  },
  bar: {
    flex: 1,
    height: 18,
    background: 'var(--bg-card)',
    borderRadius: 9,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 9,
    transition: 'width 0.3s ease',
  },
  barValue: {
    fontSize: '0.72rem',
    fontWeight: 700,
    width: 50,
    textAlign: 'right',
  },

  // Warning
  warningBox: {
    padding: '12px 16px',
    background: 'rgba(231, 76, 60, 0.08)',
    borderRadius: 10,
    border: '1px solid rgba(231, 76, 60, 0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#e74c3c',
  },

  // Collapsible
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
  },
}
