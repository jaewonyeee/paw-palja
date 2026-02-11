import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 30, transition: { duration: 0.3 } },
}

export default function Admin() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [system, setSystem] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [agentData, setAgentData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (user?.user_id !== 'admin') return
    Promise.all([api.adminStats(), api.adminSystem()])
      .then(([s, sys]) => {
        setStats(s)
        setSystem(sys)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load analytics data when switching to analytics-related tabs
  useEffect(() => {
    if (user?.user_id !== 'admin') return
    if (activeTab === 'analytics' && !analytics) {
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
    }
  }, [activeTab])

  if (user?.user_id !== 'admin') {
    return <Navigate to="/home" replace />
  }

  if (loading) {
    return (
      <motion.div {...pageTransition} style={styles.loading}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/profile')} className="btn btn-ghost">{'\u2190'} {t('common.back')}</button>
        <h3 style={styles.headerTitle}>{t('admin.title')}</h3>
        <div style={{ width: 60 }} />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'overview', label: t('admin.overview') },
          { id: 'users', label: t('admin.users') },
          { id: 'analytics', label: t('admin.analytics') },
          { id: 'system', label: t('admin.system') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="page-content" style={styles.content}>
        {activeTab === 'overview' && stats && (
          <div style={styles.overviewGrid}>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>{'\u{1F465}'}</span>
              <span style={styles.statNum}>{stats.total_users}</span>
              <span style={styles.statLabel}>{t('admin.totalUsers')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>{'\u{1F4D6}'}</span>
              <span style={styles.statNum}>{stats.total_diaries}</span>
              <span style={styles.statLabel}>{t('admin.totalDiaries')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>{'\u{1F916}'}</span>
              <span style={styles.statNum}>{system?.agents?.length || 3}</span>
              <span style={styles.statLabel}>{t('admin.agents')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>{'\u{1F4AC}'}</span>
              <span style={styles.statNum}>{system?.comment_personas?.length || 5}</span>
              <span style={styles.statLabel}>Comment Bots</span>
            </div>
          </div>
        )}

        {activeTab === 'users' && stats && (
          <div style={styles.userList}>
            {stats.users.length === 0 && (
              <p style={styles.empty}>{t('admin.noData')}</p>
            )}
            {stats.users.map((u) => (
              <div key={u.user_id} style={styles.userCard}>
                <div style={styles.userAvatar}>
                  {u.dog?.image ? (
                    <img src={u.dog.image} alt="" style={styles.userAvatarImg} />
                  ) : (
                    <span style={{ fontSize: '1.4rem' }}>{'\u{1F436}'}</span>
                  )}
                </div>
                <div style={styles.userInfo}>
                  <span style={styles.userName}>{u.nickname}</span>
                  <span style={styles.userId}>@{u.user_id}</span>
                  <span style={styles.userDog}>{u.dog?.name} {'\u00B7'} {u.dog?.breed} {'\u00B7'} {u.dog?.mbti}</span>
                </div>
                <div style={styles.userStats}>
                  <span style={styles.userDiaryCount}>{u.diary_count}</span>
                  <span style={styles.userDiaryLabel}>{t('admin.diaries')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={styles.analyticsSection}>
            {/* Overview Cards */}
            {analytics && (
              <>
                <h4 style={styles.sectionTitle}>{t('admin.overview')}</h4>
                <div style={styles.overviewGrid}>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F465}'}</span>
                    <span style={styles.statNum}>{analytics.total_users}</span>
                    <span style={styles.statLabel}>{t('admin.totalUsers')}</span>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F4C8}'}</span>
                    <span style={styles.statNum}>{analytics.dau}</span>
                    <span style={styles.statLabel}>{t('admin.dau')}</span>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F4C5}'}</span>
                    <span style={styles.statNum}>{analytics.mau}</span>
                    <span style={styles.statLabel}>{t('admin.mau')}</span>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F4D6}'}</span>
                    <span style={styles.statNum}>{analytics.total_diaries}</span>
                    <span style={styles.statLabel}>{t('admin.totalDiaries')}</span>
                  </div>
                </div>

                {/* New users breakdown */}
                <div style={{ ...styles.sysCard, marginTop: 14 }}>
                  <h4 style={styles.sysTitle}>{t('admin.newToday')} / {t('admin.newThisWeek')} / {t('admin.newThisMonth')}</h4>
                  <div style={styles.breakdownRow}>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.new_users_today}</span>
                      <span style={styles.breakdownLabel}>{t('admin.today')}</span>
                    </div>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.new_users_week}</span>
                      <span style={styles.breakdownLabel}>{t('admin.thisWeek')}</span>
                    </div>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.new_users_month}</span>
                      <span style={styles.breakdownLabel}>{t('admin.thisMonth')}</span>
                    </div>
                  </div>
                </div>

                {/* Diaries breakdown */}
                <div style={{ ...styles.sysCard, marginTop: 10 }}>
                  <h4 style={styles.sysTitle}>{t('admin.diaries')}</h4>
                  <div style={styles.breakdownRow}>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.diaries_today}</span>
                      <span style={styles.breakdownLabel}>{t('admin.today')}</span>
                    </div>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.diaries_week}</span>
                      <span style={styles.breakdownLabel}>{t('admin.thisWeek')}</span>
                    </div>
                    <div style={styles.breakdownItem}>
                      <span style={styles.breakdownNum}>{analytics.diaries_month}</span>
                      <span style={styles.breakdownLabel}>{t('admin.thisMonth')}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Engagement */}
            {engagement && (
              <>
                <h4 style={{ ...styles.sectionTitle, marginTop: 20 }}>{t('admin.engagement')}</h4>
                <div style={styles.overviewGrid}>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F4CA}'}</span>
                    <span style={styles.statNum}>{engagement.avg_diaries_per_user}</span>
                    <span style={styles.statLabel}>{t('admin.avgDiariesPerUser')}</span>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>{'\u{1F504}'}</span>
                    <span style={styles.statNum}>{engagement.retention_rate_7d}%</span>
                    <span style={styles.statLabel}>{t('admin.retentionRate')}</span>
                  </div>
                </div>

                {/* Daily diaries table */}
                {engagement.daily_diaries?.length > 0 && (
                  <div style={{ ...styles.sysCard, marginTop: 14 }}>
                    <h4 style={styles.sysTitle}>{t('admin.diaries')} (7 {t('admin.period')})</h4>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Date</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {engagement.daily_diaries.map((d) => (
                          <tr key={d.date}>
                            <td style={styles.td}>{d.date}</td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{d.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Most active hours */}
                {engagement.active_hours?.length > 0 && (
                  <div style={{ ...styles.sysCard, marginTop: 10 }}>
                    <h4 style={styles.sysTitle}>{t('admin.mostActiveHours')}</h4>
                    <div style={styles.barChart}>
                      {engagement.active_hours.slice(0, 6).map((h) => (
                        <div key={h.hour} style={styles.barItem}>
                          <div style={styles.barLabel}>{t('admin.hour', { hour: h.hour })}</div>
                          <div style={styles.barTrack}>
                            <div
                              style={{
                                ...styles.barFill,
                                width: `${Math.min(100, (h.count / Math.max(...engagement.active_hours.map(x => x.count))) * 100)}%`,
                              }}
                            />
                          </div>
                          <div style={styles.barCount}>{h.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Agent Usage */}
            {agentData && (
              <>
                <h4 style={{ ...styles.sectionTitle, marginTop: 20 }}>{t('admin.agentUsage')}</h4>
                <div style={styles.sysCard}>
                  {agentData.agent_usage?.map((a) => (
                    <div key={a.agent} style={styles.sysRow}>
                      <span style={styles.sysLabel}>{a.agent}</span>
                      <span style={styles.sysValue}>{t('admin.diariesCount', { count: a.count })}</span>
                    </div>
                  ))}
                  {(!agentData.agent_usage || agentData.agent_usage.length === 0) && (
                    <p style={styles.empty}>{t('admin.noData')}</p>
                  )}
                </div>
              </>
            )}

            {!analytics && !engagement && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'system' && system && (
          <div style={styles.systemSection}>
            <div style={styles.sysCard}>
              <h4 style={styles.sysTitle}>Server Info</h4>
              <div style={styles.sysRow}>
                <span style={styles.sysLabel}>Version</span>
                <span style={styles.sysValue}>{system.version}</span>
              </div>
              <div style={styles.sysRow}>
                <span style={styles.sysLabel}>LLM Provider</span>
                <span style={styles.sysValue}>{system.llm_provider}</span>
              </div>
            </div>

            <div style={styles.sysCard}>
              <h4 style={styles.sysTitle}>AI Agents</h4>
              <div style={styles.tagRow}>
                {system.agents.map((a) => (
                  <span key={a} style={styles.tag}>{a}</span>
                ))}
              </div>
            </div>

            <div style={styles.sysCard}>
              <h4 style={styles.sysTitle}>Comment Personas</h4>
              <div style={styles.tagRow}>
                {system.comment_personas.map((p) => (
                  <span key={p} style={styles.tag}>{p}</span>
                ))}
              </div>
            </div>

            <div style={styles.sysCard}>
              <h4 style={styles.sysTitle}>Features</h4>
              <div style={styles.tagRow}>
                {system.features.map((f) => (
                  <span key={f} style={{ ...styles.tag, background: 'rgba(108,92,231,0.08)', color: 'var(--bg-purple)' }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  loading: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  headerTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    padding: '0 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  tab: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: 'var(--bg-purple)',
    borderBottomColor: 'var(--bg-purple)',
  },
  content: {
    padding: '16px 20px 40px',
    overflowY: 'auto',
    flex: 1,
  },
  // Overview
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
  statIcon: { fontSize: '1.5rem' },
  statNum: {
    fontSize: '1.8rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  statLabel: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  // Users
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  empty: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: 40,
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--bg-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  userAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  userName: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  userId: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  userDog: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
  },
  userStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  userDiaryCount: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'var(--bg-purple)',
  },
  userDiaryLabel: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  // System
  systemSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sysCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '16px 18px',
    border: '1px solid var(--border-light)',
  },
  sysTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 10,
  },
  sysRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--border-light)',
  },
  sysLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  sysValue: {
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
  },
  // Analytics
  analyticsSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 10,
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: 8,
  },
  breakdownItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  breakdownNum: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--bg-purple)',
  },
  breakdownLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  // Table
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    padding: '6px 0',
    textAlign: 'left',
    borderBottom: '1px solid var(--border-light)',
  },
  td: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    padding: '8px 0',
    borderBottom: '1px solid var(--border-light)',
  },
  // Bar chart
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  barItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    width: 40,
    textAlign: 'right',
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 14,
    background: 'var(--bg-card)',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 7,
    transition: 'width 0.4s ease',
  },
  barCount: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    width: 28,
    textAlign: 'right',
    flexShrink: 0,
  },
}
