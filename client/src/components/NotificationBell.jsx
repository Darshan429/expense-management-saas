import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';

const TYPE_CONFIG = {
  EXPENSE_APPROVED:  { color: '#1D9E75', icon: '✓', label: 'Approved' },
  EXPENSE_REJECTED:  { color: '#E24B4A', icon: '✗', label: 'Rejected' },
  BUDGET_ALERT:      { color: '#BA7517', icon: '⚠', label: 'Budget Alert' },
  EXPENSE_SUBMITTED: { color: '#378ADD', icon: '↑', label: 'New Submission' }
};

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markOneRead(notif.id);
    if (notif.expense_id && onNavigate) {
      onNavigate(`/expenses/${notif.expense_id}`);
    }
    setOpen(false);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Bell Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:   'relative',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    8,
          fontSize:   20
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position:   'absolute',
            top:        2,
            right:      2,
            background: '#E24B4A',
            color:      '#fff',
            borderRadius: '50%',
            fontSize:   10,
            fontWeight: 600,
            width:      18,
            height:     18,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <>
          {/* Backdrop — click outside to close */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99
            }}
          />

          <div style={{
            position:   'absolute',
            right:      0,
            top:        '110%',
            width:      340,
            maxHeight:  440,
            overflowY:  'auto',
            background: 'var(--color-background-primary)',
            border:     '0.5px solid var(--color-border-tertiary)',
            borderRadius: 12,
            zIndex:     100,
            boxShadow:  '0 4px 24px rgba(0,0,0,0.12)'
          }}>

            {/* Header */}
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '12px 16px',
              borderBottom:   '0.5px solid var(--color-border-tertiary)',
              position:       'sticky',
              top:            0,
              background:     'var(--color-background-primary)'
            }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>
                Notifications
                {unreadCount > 0 && (
                  <span style={{
                    marginLeft:   8,
                    fontSize:     11,
                    background:   '#E24B4A',
                    color:        '#fff',
                    padding:      '1px 6px',
                    borderRadius: 10
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize:   12,
                    color:      '#378ADD',
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer'
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            {notifications.length === 0 ? (
              <div style={{
                padding:   32,
                textAlign: 'center',
                color:     'var(--color-text-tertiary)',
                fontSize:  13
              }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.EXPENSE_SUBMITTED;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      padding:      '10px 16px',
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      background:   n.is_read
                        ? 'transparent'
                        : 'color-mix(in srgb, #378ADD 8%, transparent)',
                      cursor:       n.expense_id ? 'pointer' : 'default',
                      transition:   'background .15s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {/* Icon */}
                      <div style={{
                        width:          28,
                        height:         28,
                        borderRadius:   '50%',
                        background:     cfg.color + '20',
                        color:          cfg.color,
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        fontSize:       13,
                        fontWeight:     600,
                        flexShrink:     0
                      }}>
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize:   13,
                          fontWeight: n.is_read ? 400 : 500,
                          color:      'var(--color-text-primary)',
                          marginBottom: 2
                        }}>
                          {n.title}
                        </div>
                        <div style={{
                          fontSize:   12,
                          color:      'var(--color-text-secondary)',
                          lineHeight: 1.4
                        }}>
                          {n.message}
                        </div>
                        <div style={{
                          fontSize:  11,
                          color:     'var(--color-text-tertiary)',
                          marginTop: 4
                        }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <div style={{
                          width:        8,
                          height:       8,
                          borderRadius: '50%',
                          background:   '#378ADD',
                          flexShrink:   0,
                          marginTop:    4
                        }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}