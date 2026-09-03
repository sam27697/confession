const SCREENS = [
  { id: 'landing', label: 'الصفحة الرئيسية' },
  { id: 'onboarding', label: 'الشروط (١٨+)' },
  { id: 'inbox', label: 'الصندوق' },
  { id: 'inbox-empty', label: 'صندوق فاضي' },
  { id: 'send', label: 'صفحة الإرسال' },
  { id: 'send-signin', label: 'إرسال · تسجيل دخول' },
  { id: 'send-sent', label: 'إرسال · وصلت' },
  { id: 'send-off', label: 'إرسال · مطفي' },
  { id: 'send-ratelimit', label: 'إرسال · الحد' },
  { id: 'sent', label: 'يلي بعتها' },
  { id: 'sent-empty', label: 'يلي بعتها · فاضي' },
  { id: 'offer', label: 'المصارحة · بانتظاره' },
  { id: 'offer-resolved', label: 'المصارحة · انكشفوا' },
  { id: 'offer-declined', label: 'المصارحة · رفض' },
  { id: 'offer-waiting', label: 'المصارحة · عم تستنى' },
  { id: 'delete', label: 'حذف الحساب' },
  { id: 'delete-done', label: 'حذف · تم' },
  { id: 'terms', label: 'الشروط' },
  { id: 'privacy', label: 'الخصوصية' }
]

function App() {
  const [screen, setScreen] = React.useState('inbox')
  const [enabled, setEnabled] = React.useState(true)
  const signedIn = !['landing', 'onboarding', 'send', 'send-signin', 'send-sent', 'send-off', 'send-ratelimit'].includes(screen)
  const nav = signedIn && !screen.startsWith('delete')

  let body = null
  if (screen === 'landing') body = <Landing onLogin={() => setScreen('onboarding')} />
  else if (screen === 'onboarding') body = <Onboarding onAccept={() => setScreen('inbox')} />
  else if (screen === 'inbox' || screen === 'inbox-empty') body = <Inbox empty={screen === 'inbox-empty'} enabled={enabled} onToggle={setEnabled} onDelete={() => setScreen('delete')} />
  else if (screen.startsWith('send')) {
    const st = screen === 'send' ? 'ready' : screen.replace('send-', '')
    body = <SendPage state={st} onState={(s) => setScreen(s === 'ready' ? 'send' : 'send-' + s)} />
  }
  else if (screen === 'sent' || screen === 'sent-empty') body = <SentList empty={screen === 'sent-empty'} onOpenOffer={() => setScreen('offer')} />
  else if (screen === 'offer') body = <OfferScreen state="pending" viewpoint="sender" onAccept={() => setScreen('offer-resolved')} onDecline={() => setScreen('offer-declined')} />
  else if (screen === 'offer-resolved') body = <OfferScreen state="resolved" />
  else if (screen === 'offer-declined') body = <OfferScreen state="declined" />
  else if (screen === 'offer-waiting') body = <OfferScreen state="pending" viewpoint="recipient" />
  else if (screen === 'delete') body = <AccountDelete onDone={() => setScreen('delete-done')} />
  else if (screen === 'delete-done') body = <AccountDelete done />
  else body = <Legal kind={screen === 'terms' ? 'terms' : 'privacy'} />

  const veil = screen === 'landing' ? 'var(--veil-citron)'
    : screen.startsWith('offer') ? 'var(--veil-rose)'
    : screen.startsWith('send') ? 'var(--veil-citron)' : 'none'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ground-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '900px' }}>
        {SCREENS.map((s) => (
          <button key={s.id} type="button" onClick={() => setScreen(s.id)} style={{
            background: screen === s.id ? 'var(--citron-500)' : 'var(--surface-1)',
            color: screen === s.id ? 'var(--text-on-accent)' : 'var(--text-2)',
            border: '1px solid ' + (screen === s.id ? 'var(--citron-500)' : 'var(--line)'),
            borderRadius: 'var(--radius-pill)', padding: '7px 12px', font: 'var(--type-micro)', cursor: 'pointer'
          }}>{s.label}</button>
        ))}
      </div>
      <PhoneShell veil={veil}>
        {nav ? <AppHeader active={screen.startsWith('sent') ? 'sent' : 'inbox'} onNavigate={(id) => setScreen(id)} /> : null}
        {!signedIn && screen.startsWith('send') ? <AppHeader signedIn={false} /> : null}
        {body}
      </PhoneShell>
    </div>
  )
}

Object.assign(window, { App, SCREENS })
