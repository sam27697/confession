const { Button, Card, Notice, StateChip, TextField, TextArea, BrandMark, AppHeader, HourStamp, toArabicDigits } = window.MasarahaDesignSystem_b05309

const wrap = { maxWidth: '820px', margin: '0 auto', padding: '24px var(--gutter-desktop) 64px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }
const title = { font: 'var(--type-title)', color: 'var(--text-1)' }
const meta = { font: 'var(--type-micro)', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }

const QUEUE = [
  { id: 'c1f8', body: 'رسالة فيها تهديد مباشر لشخص باسمه ورقم تلفونو.', day: 'اليوم', hour: 3, meridiem: 'ص', status: 'reported', reason: 'تهديد ونشر معلومات شخصية' },
  { id: 'a09d', body: 'كلام مؤذي متكرر لنفس الشخص أكتر من مرة.', day: 'اليوم', hour: 1, meridiem: 'ص', status: 'reported', reason: 'تحرّش' },
  { id: '77bc', body: 'رسالة عادية انبلغ عنها بالغلط.', day: 'أمس', hour: 11, meridiem: 'م', status: 'delivered', reason: 'مش مناسب' }
]

/** The reason field IS the wall. Under 8 characters, the reveal button does not exist as a usable control. */
function RevealAction({ id }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [done, setDone] = React.useState(false)
  const ok = reason.trim().length >= 8
  if (done) {
    return (
      <div style={{ background: 'var(--danger-wash)', border: '1px solid rgba(255,92,77,.32)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--danger-500)' }}>انكشف المرسل · انسجل بالسجل الثابت</span>
        <span style={{ font: 'var(--type-body-strong)', color: 'var(--text-1)' }}>سامر ف.</span>
        <span style={meta}>reason: {reason.trim()}</span>
      </div>
    )
  }
  if (!open) return <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>اكشف المرسل…</Button>
  return (
    <div style={{ border: '1px solid var(--danger-700)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--surface-2)' }}>
      <Notice tone="danger" title="هالخطوة بتنسجل نهائياً">كشف الهوية بينسجل بسجل ما ينحذف وما ينعدّل: مين كشف، أي رسالة، إيمتى، وليش.</Notice>
      <TextArea id={'rv-' + id} label="ليش عم تكشفه؟ (٨ أحرف على الأقل)" rows={2} value={reason} onChange={setReason} maxLength={500}
        hint={ok ? 'جاهز.' : 'لازم سبب مكتوب — مش أقل من ٨ أحرف.'} />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button variant="destructiveSolid" size="md" disabled={!ok} onClick={() => setDone(true)}>اكشف المرسل</Button>
        <Button variant="ghost" size="md" onClick={() => { setOpen(false); setReason('') }}>خلص</Button>
      </div>
    </div>
  )
}

function AdminLogin({ onIn }) {
  const [u, setU] = React.useState('')
  const [p, setP] = React.useState('')
  const [err, setErr] = React.useState(false)
  return (
    <div style={{ ...wrap, maxWidth: '420px', minHeight: '100vh', justifyContent: 'center' }}>
      <BrandMark size={36} tone="light" />
      <div style={title}>دخول الإدارة</div>
      {err ? <Notice tone="danger">اسم المستخدم أو كلمة السر غير صحيحة</Notice> : null}
      <Card pad="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <TextField id="au" label="اسم المستخدم" value={u} onChange={setU} />
        <TextField id="ap" label="كلمة السر" type="password" value={p} onChange={setP} />
        <Button variant="secondary" block onClick={() => (u && p ? onIn() : setErr(true))}>دخول</Button>
      </Card>
      <p style={{ font: 'var(--type-caption)', color: 'var(--text-3)' }}>كل محاولات الدخول محدودة. الجلسة ٨ ساعات.</p>
    </div>
  )
}

function AdminQueue({ view = 'messages' }) {
  const rows = view === 'reports' ? QUEUE : QUEUE.concat([{ id: '4e2a', body: 'رسالة عادية وصلت وما صار عليها شي.', day: 'أمس', hour: 8, meridiem: 'م', status: 'delivered' }])
  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={title}>{view === 'reports' ? 'البلاغات' : 'الرسايل'}</span>
        <span style={meta}>{toArabicDigits(rows.length)} / limit 50</span>
      </div>
      <Notice tone="info">كل الصفوف مقنّعة. هوية المرسل ما بتظهر إلا بكشف مسجّل بسبب مكتوب.</Notice>
      {rows.map((r) => (
        <Card key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={meta} dir="ltr">#{r.id}</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <HourStamp day={r.day} hour={r.hour} meridiem={r.meridiem} />
              <StateChip state={r.status === 'reported' ? 'reported' : 'delivered'} />
            </div>
          </div>
          <p style={{ font: 'var(--type-body)', color: 'var(--text-1)' }}>{r.body}</p>
          {r.reason && view === 'reports' ? (
            <div style={{ borderInlineStart: '2px solid var(--line-strong)', paddingInlineStart: '12px' }}>
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>سبب البلاغ</div>
              <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-1)' }}>{r.reason}</div>
            </div>
          ) : null}
          <RevealAction id={r.id} />
        </Card>
      ))}
    </div>
  )
}

function AdminApp() {
  const [signed, setSigned] = React.useState(true)
  const [view, setView] = React.useState('reports')
  if (!signed) return <AdminLogin onIn={() => setSigned(true)} />
  return (
    <>
      <AppHeader plain active={view === 'reports' ? 'reports' : 'admin'} onNavigate={(id) => setView(id === 'reports' ? 'reports' : 'messages')} />
      <AdminQueue view={view} />
      <div style={{ ...wrap, paddingTop: 0 }}>
        <Button variant="ghost" size="sm" onClick={() => setSigned(false)}>تسجيل خروج</Button>
      </div>
    </>
  )
}

Object.assign(window, { AdminApp, AdminLogin, AdminQueue, RevealAction })
