import { motion } from 'motion/react'

const pageTransition = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: 30, transition: { duration: 0.2 } },
}

export default function Profile({ user, onLogout, navigate }) {
  const dog = user.dog || {}

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('home')} className="btn btn-ghost">← 뒤로</button>
        <h3 style={styles.headerTitle}>프로필</h3>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content" style={styles.content}>
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={styles.profileCard}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            style={styles.avatarBig}
          >
            {dog.image ? (
              <img src={dog.image} alt="dog" style={styles.avatarImg} />
            ) : (
              '🐾'
            )}
          </motion.div>
          <h2 style={styles.nickname}>{user.nickname}</h2>
          <p style={styles.userId}>@{user.user_id}</p>
        </motion.div>

        {/* Dog info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={styles.card}
        >
          <h4 style={styles.cardTitle}>반려견 정보</h4>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>이름</span>
              <span style={styles.infoValue}>{dog.name || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>견종</span>
              <span style={styles.infoValue}>{dog.breed || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>MBTI</span>
              <span style={styles.infoValue}>{dog.mbti || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>일기 알림</span>
              <span style={styles.infoValue}>{user.diary_time || '09:00'}</span>
            </div>
          </div>
        </motion.div>

        {/* Menu items - admin only */}
        {user.user_id === 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={styles.menuSection}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('admin')}
              style={styles.menuItem}
            >
              <span style={styles.menuIcon}>🛠</span>
              <span style={styles.menuLabel}>관리자 대시보드</span>
              <span style={styles.menuArrow}>→</span>
            </motion.button>
          </motion.div>
        )}

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={styles.logoutWrap}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onLogout}
            style={styles.logoutBtn}
          >
            로그아웃
          </motion.button>
        </motion.div>
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
  content: {
    padding: '20px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  profileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '28px 20px',
    background: 'linear-gradient(135deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 'var(--radius-lg)',
  },
  avatarBig: {
    width: 72,
    height: 72,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nickname: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'white',
  },
  userId: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
  },
  card: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '18px 20px',
    border: '1.5px solid var(--border-light)',
  },
  cardTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 14,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  infoLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  infoValue: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  // Menu
  menuSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
  },
  menuIcon: {
    fontSize: '1.2rem',
  },
  menuLabel: {
    flex: 1,
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  menuArrow: {
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
  },
  logoutWrap: {
    marginTop: 8,
  },
  logoutBtn: {
    width: '100%',
    padding: '14px',
    border: '1.5px solid #E74C3C',
    borderRadius: 'var(--radius-full)',
    background: 'transparent',
    color: '#E74C3C',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
}
