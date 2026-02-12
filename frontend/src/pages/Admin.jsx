import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { LayoutDashboard, Users, BookOpen, BarChart3, Database, Settings, Search, ChevronLeft, ChevronRight, X, Trash2, Eye, RefreshCw } from 'lucide-react'

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
  if (pages <= 1) return null
  const { t } = useTranslation()
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

// --- Dashboard Panel ---
function DashboardPanel({ stats, system, t }) {
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

// --- Analytics Panel (existing logic) ---
function AnalyticsPanel({ t }) {
  const [analytics, setAnalytics] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [agentData, setAgentData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.analyticsOverview(),
      api.analyticsEngagement(),
      api.analyticsAgents(),
    ])
      .then(([ov, eng, ag]) => {
        setAnalytics(ov)
        setEngagement(eng)
        setAgentData(ag)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.analytics')}</h2>
      {analytics && (
        <>
          <div style={s.statGrid}>
            <StatCard icon="👥" value={analytics.total_users} label={t('admin.totalUsers')} />
            <StatCard icon="📈" value={analytics.dau} label={t('admin.dau')} />
            <StatCard icon="📅" value={analytics.mau} label={t('admin.mau')} />
            <StatCard icon="📖" value={analytics.total_diaries} label={t('admin.totalDiaries')} />
          </div>
          <div style={{ ...s.card, marginTop: 14 }}>
            <h4 style={s.cardTitle}>{t('admin.newToday')} / {t('admin.newThisWeek')} / {t('admin.newThisMonth')}</h4>
            <div style={s.breakdownRow}>
              <div style={s.breakdownItem}>
                <span style={s.breakdownNum}>{analytics.new_users_today}</span>
                <span style={s.breakdownLabel}>{t('admin.today')}</span>
              </div>
              <div style={s.breakdownItem}>
                <span style={s.breakdownNum}>{analytics.new_users_week}</span>
                <span style={s.breakdownLabel}>{t('admin.thisWeek')}</span>
              </div>
              <div style={s.breakdownItem}>
                <span style={s.breakdownNum}>{analytics.new_users_month}</span>
                <span style={s.breakdownLabel}>{t('admin.thisMonth')}</span>
              </div>
            </div>
          </div>
        </>
      )}
      {engagement && (
        <>
          <div style={{ ...s.statGrid, marginTop: 16 }}>
            <StatCard icon="📊" value={engagement.avg_diaries_per_user} label={t('admin.avgDiariesPerUser')} />
            <StatCard icon="🔄" value={`${engagement.retention_rate_7d}%`} label={t('admin.retentionRate')} />
          </div>
          {engagement.active_hours?.length > 0 && (
            <div style={{ ...s.card, marginTop: 14 }}>
              <h4 style={s.cardTitle}>{t('admin.mostActiveHours')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {engagement.active_hours.slice(0, 6).map((h) => (
                  <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{t('admin.hour', { hour: h.hour })}</span>
                    <div style={{ flex: 1, height: 14, background: 'var(--bg-card)', borderRadius: 7, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--bg-purple), var(--bg-purple-light))', borderRadius: 7, width: `${Math.min(100, (h.count / Math.max(...engagement.active_hours.map(x => x.count))) * 100)}%` }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, width: 28, textAlign: 'right' }}>{h.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {agentData?.agent_usage?.length > 0 && (
        <div style={{ ...s.card, marginTop: 14 }}>
          <h4 style={s.cardTitle}>{t('admin.agentUsage')}</h4>
          {agentData.agent_usage.map((a) => (
            <div key={a.agent} style={s.kvRow}>
              <span style={s.kvLabel}>{a.agent}</span>
              <span style={s.kvValue}>{t('admin.diariesCount', { count: a.count })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- DB & API Panel ---
function DbApiPanel({ t }) {
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

  if (loading) return <Spinner />

  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.dbAndApi')}</h2>

      {/* DB Status */}
      {dbStatus && (
        <div style={s.card}>
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

        {apiUsage && (
          <>
            <div style={s.statGrid}>
              <StatCard icon="📡" value={apiUsage.total_calls} label={t('admin.apiCalls')} />
              <StatCard icon="🎯" value={`${apiUsage.success_rate}%`} label={t('admin.successRate')} />
              <StatCard icon="🔤" value={apiUsage.total_tokens.toLocaleString()} label={t('admin.totalTokens')} />
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

// --- System Panel (existing logic) ---
function SystemPanel({ system, t }) {
  if (!system) return <Spinner />
  return (
    <div>
      <h2 style={s.panelTitle}>{t('admin.system')}</h2>
      <div style={s.card}>
        <h4 style={s.cardTitle}>Server Info</h4>
        <div style={s.kvRow}><span style={s.kvLabel}>Version</span><span style={s.kvValue}>{system.version}</span></div>
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
    </div>
  )
}


// --- Main Admin Component ---
const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'admin.dashboard' },
  { id: 'users', icon: Users, labelKey: 'admin.userManagement' },
  { id: 'diaries', icon: BookOpen, labelKey: 'admin.diaryBrowser' },
  { id: 'analytics', icon: BarChart3, labelKey: 'admin.analytics' },
  { id: 'dbapi', icon: Database, labelKey: 'admin.dbAndApi' },
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
        {activePanel === 'dashboard' && <DashboardPanel stats={stats} system={system} t={t} />}
        {activePanel === 'users' && <UsersPanel t={t} />}
        {activePanel === 'diaries' && <DiariesPanel t={t} />}
        {activePanel === 'analytics' && <AnalyticsPanel t={t} />}
        {activePanel === 'dbapi' && <DbApiPanel t={t} />}
        {activePanel === 'system' && <SystemPanel system={system} t={t} />}
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
}
