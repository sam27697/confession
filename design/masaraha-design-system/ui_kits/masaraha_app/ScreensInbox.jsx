const QUESTIONS = [
  'شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟',
  'شو الشي يلي دايماً بتحس إني ما فهمته عنك؟',
  'وين كنت غلطان معي وما اعترفت؟'
]
const STAKES = [
  'رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا.',
  'رح قلك الشي يلي زعلني منك وما حكيته.',
  'رح قلك ليش بعدت.'
]

const SEED = [
  { id: 'a', body: 'كنت دايماً أحسن مني بهاد الشي وما قلتلك ولا مرة. صرلي سنتين عم فكر فيها.', day: 'اليوم', hour: 2, meridiem: 'ص', status: 'delivered' },
  { id: 'b', body: 'ما بعرف كيف قلك، بس من هداك النهار يلي حكينا فيه عن أهلك، صار في شي بينا مختلف. وأنا يلي غيّرته، ما إنت. كنت خايف تحكي معي وتكتشف إني ما بستاهل هالثقة، فبعدت أنا قبل ما تبعد إنت. وهلق صرلي سنة عم حاول رجّع الشي يلي كسرته بإيدي، وما عرفت من وين أبلش، فبعتلك هون لأني ما قدرت أبعتلك بمكان تاني.', day: 'اليوم', hour: 1, meridiem: 'ص', status: 'delivered', long: true },
  { id: 'c', body: 'انت أحسن شي صار معي هالسنة، بس ما رح قلك مين أنا.', day: 'أمس', hour: 11, meridiem: 'م', status: 'delivered', offerState: 'pending' },
  { id: 'd', body: 'رسالة فيها كلام مؤذي.', day: 'أمس', hour: 9, meridiem: 'م', status: 'reported' },
  { id: 'e', body: 'خبيتها لأني ما بدي أشوفها كل مرة.', day: '٢٨ آب', hour: 4, meridiem: 'م', status: 'hidden' }
]

function OfferComposer({ onClose, onSend }) {
  const [q, setQ] = React.useState('')
  const [s, setS] = React.useState('')
  const [a, setA] = React.useState('')
  const ready = q.trim().length > 1 && s.trim().length > 1 && a.trim().length > 1
  const chip = (t, on) => ({
    background: 'var(--surface-2)', border: '1px solid var(--line)', color: on ? 'var(--rose-100)' : 'var(--text-2)',
    borderRadius: 'var(--radius-chip)', padding: '8px 12px', font: 'var(--type-caption)', cursor: 'pointer', textAlign: 'right'
  })
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-scrim)', display: 'flex', alignItems: 'flex-end', zIndex: 10 }}>
      <div style={{
        width: '100%', maxHeight: '92%', overflowY: 'auto', background: 'var(--surface-1)', backgroundImage: 'var(--veil-rose)',
        borderRadius: '28px 28px 0 0', borderTop: '1px solid var(--rose-700)', boxShadow: 'var(--shadow-sheet)',
        padding: 'var(--card-pad-lg)', paddingBottom: 'var(--safe-bottom)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ font: 'var(--type-subtitle)', color: 'var(--rose-100)' }}>صارحني بدورك</span>
          <Button variant="ghost" size="sm" onClick={onClose}>سكّر</Button>
        </div>
        <p style={muted}>بتحكيلو شي عن حالك، وبتطلب منه شي بالمقابل. ما حدا بيشوف جواب التاني قبل ما ينزلوا الاتنين سوا.</p>
        <TextField id="of-q" label="شو بدك تسأله؟" value={q} onChange={setQ} maxLength={500} counter placeholder="اكتب سؤالك، أو اختار من تحت" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {QUESTIONS.map((t) => <button key={t} type="button" style={chip(t, q === t)} onClick={() => setQ(t)}>{t}</button>)}
        </div>
        <TextField id="of-s" label="وشو رح تحكيله عن حالك؟" value={s} onChange={setS} maxLength={500} counter hint="لازم يكون شي بنفس الصراحة. هيدا يلي بيخليه يرد." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {STAKES.map((t) => <button key={t} type="button" style={chip(t, s === t)} onClick={() => setS(t)}>{t}</button>)}
        </div>
        <TextArea id="of-a" label="جوابك الحقيقي — يضل مخبى لحد ما يوافق" rows={3} value={a} onChange={setA} maxLength={4000} hint="جوابك محفوظ من هلق وما فيك تغيّره بعدين." />
        <Button variant="reveal" block disabled={!ready} onClick={onSend}>ابعت العرض</Button>
      </div>
    </div>
  )
}

function Inbox({ empty = false, onDelete, enabled = true, onToggle }) {
  const [msgs, setMsgs] = React.useState(SEED)
  const [copied, setCopied] = React.useState(false)
  const [composing, setComposing] = React.useState(null)
  const [open, setOpen] = React.useState({})
  const set = (id, patch) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const list = empty ? [] : msgs
  return (
    <>
      <div style={{ ...page, paddingTop: 'var(--space-3)' }}>
        <LinkBlock enabled={enabled} onToggle={onToggle} copied={copied}
          onCopy={() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
          <span style={h1}>صندوقك</span>
          {list.length ? <span style={faint}>{toArabicDigits(list.length)} رسائل</span> : null}
        </div>
        {list.length === 0 ? (
          <EmptyState title="صندوقك لسا فاضي" body="حط رابطك بستوري أو بالبايو. أول رسالة بتوصل أسرع مما تتخيل."
            action={<Button variant="primary" size="md">شارك رابطك</Button>} />
        ) : list.map((m) => (
          <MessageCard key={m.id} body={m.body} day={m.day} hour={m.hour} meridiem={m.meridiem}
            status={m.status} offerState={m.offerState} truncate={m.long} expanded={!!open[m.id]}
            onExpand={() => setOpen((o) => ({ ...o, [m.id]: true }))}
            actions={m.offerState ? null : <>
              <Button variant="reveal" size="sm" onClick={() => setComposing(m.id)}>صارحني بدورك</Button>
              <Button variant="secondary" size="sm" onClick={() => set(m.id, { status: m.status === 'hidden' ? 'delivered' : 'hidden' })}>{m.status === 'hidden' ? 'رجّعها' : 'خبيها'}</Button>
              <Button variant="ghost" size="sm" onClick={() => set(m.id, { status: 'reported' })}>بلغ</Button>
              <Button variant="destructive" size="sm">احظر صاحبها</Button>
            </>}>
            {m.offerState === 'pending' ? <RevealPanel state="pending" viewpoint="recipient"
              question="شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟" stake="رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا."
              footer={<Button variant="secondary" size="sm">اسحب العرض</Button>} /> : null}
          </MessageCard>
        ))}
        <div style={{ paddingTop: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
          <Button variant="ghost" size="sm" onClick={onDelete}>حذف الحساب</Button>
        </div>
      </div>
      {composing ? <OfferComposer onClose={() => setComposing(null)} onSend={() => { set(composing, { offerState: 'pending' }); setComposing(null) }} /> : null}
    </>
  )
}

function AccountDelete({ onDone, done = false }) {
  const [word, setWord] = React.useState('')
  if (done) {
    return (
      <div style={{ ...page, flex: 1, justifyContent: 'center', textAlign: 'center', gap: 'var(--space-5)' }}>
        <div style={h1}>تم حذف حسابك</div>
        <p style={muted}>انحذف اسمك ورابطك وكل الرسائل يلي وصلتك. الرسائل يلي بعتها إنت لناس تانيين ضلّت عندهم، بدون اسمك.</p>
        <Button variant="secondary" block>رجوع للصفحة الرئيسية</Button>
      </div>
    )
  }
  return (
    <div style={{ ...page, paddingTop: 'var(--space-4)' }}>
      <div style={h1}>حذف الحساب</div>
      <Notice tone="danger">هالخطوة ما فيها رجعة. ما منقدر نرجعلك ولا رسالة بعد ما تنحذف.</Notice>
      <Card pad="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--danger-500)' }}>يلي رح ينحذف</div>
        {['اسمك وحسابك عنا', 'رابطك، وما حدا يقدر يستعملو بعدها', 'كل الرسائل يلي وصلتك', 'عروض المصارحة والأجوبة المرتبطة فيها'].map((t) => (
          <p key={t} style={{ font: 'var(--type-body-sm)', color: 'var(--text-1)' }}>{t}</p>
        ))}
      </Card>
      <Card pad="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>يلي رح يضل</div>
        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>الرسائل يلي بعتها إنت لناس تانيين — بتضل عندهم، بدون اسمك.</p>
        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>سجل الإدارة إذا كان في كشف صار سابقاً. هالسجل ثابت وما بينحذف.</p>
      </Card>
      <TextField id="del" label="اكتب «حذف» لتأكيد" value={word} onChange={setWord} placeholder="حذف" />
      <Button variant="destructiveSolid" block disabled={word.trim() !== 'حذف'} onClick={onDone}>احذف حسابي نهائياً</Button>
      <Button variant="ghost" block>خلص، رجعني</Button>
    </div>
  )
}

Object.assign(window, { Inbox, AccountDelete, OfferComposer, SEED })
