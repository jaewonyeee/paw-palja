import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 30, transition: { duration: 0.3 } },
}

export default function Admin({ navigate }) {
  const [stats, setStats] = useState(null)
  const [system, setSystem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    Promise.all([api.adminStats(), api.adminSystem()])
      .then(([s, sys]) => {
        setStats(s)
        setSystem(sys)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
        <button onClick={() => navigate('profile')} className="btn btn-ghost">← 뒤로</button>
        <h3 style={styles.headerTitle}>Admin Dashboard</h3>
        <div style={{ width: 60 }} />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: 'Users' },
          { id: 'system', label: 'System' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-content" style={styles.content}>
        {activeTab === 'overview' && stats && (
          <div style={styles.overviewGrid}>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>👥</span>
              <span style={styles.statNum}>{stats.total_users}</span>
              <span style={styles.statLabel}>Total Users</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>📖</span>
              <span style={styles.statNum}>{stats.total_diaries}</span>
              <span style={styles.statLabel}>Total Diaries</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>🤖</span>
              <span style={styles.statNum}>{system?.agents?.length || 3}</span>
              <span style={styles.statLabel}>Active Agents</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statIcon}>💬</span>
              <span style={styles.statNum}>{system?.comment_personas?.length || 5}</span>
              <span style={styles.statLabel}>Comment Bots</span>
            </div>
          </div>
        )}

        {activeTab === 'users' && stats && (
          <div style={styles.userList}>
            {stats.users.length === 0 && (
              <p style={styles.empty}>등록된 사용자가 없습니다.</p>
            )}
            {stats.users.map((u) => (
              <div key={u.user_id} style={styles.userCard}>
                <div style={styles.userAvatar}>
                  {u.dog?.image ? (
                    <img src={u.dog.image} alt="" style={styles.userAvatarImg} />
                  ) : (
                    <span style={{ fontSize: '1.4rem' }}>🐶</span>
                  )}
                </div>
                <div style={styles.userInfo}>
                  <span style={styles.userName}>{u.nickname}</span>
                  <span style={styles.userId}>@{u.user_id}</span>
                  <span style={styles.userDog}>{u.dog?.name} · {u.dog?.breed} · {u.dog?.mbti}</span>
                </div>
                <div style={styles.userStats}>
                  <span style={styles.userDiaryCount}>{u.diary_count}</span>
                  <span style={styles.userDiaryLabel}>일기</span>
                </div>
              </div>
            ))}
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
    fontSize: '0.82rem',
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
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
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
}
