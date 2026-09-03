/** /c/[slug] — the public send page. state: ready | signin | sent | off | ratelimit | blocked */
function SendPage({ state = 'ready', owner = 'سامر', onSend, onState }) {
  const [body, setBody] = React.useState('')
  const wrap = { ...page, flex: 1, paddingTop: 'var(--space-6)', gap: 'var(--space-5)' }

  if (state === 'off') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', textAlign: 'center' }}>
        <BrandMark size={56} tone="light" style={{ alignSelf: 'center', opacity: .5 }} />
        <div style={h1}>هالرابط مطفي هلق</div>
        <p style={muted}>صاحب الرابط وقّف الرسائل. جرب بعدين.</p>
      </div>
    )
  }

  if (state === 'sent') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', textAlign: 'center', gap: 'var(--space-6)' }}>
        <div style={{ width: '84px', height: '84px', alignSelf: 'center', borderRadius: 'var(--radius-bubble)', background: 'var(--citron-500)', color: 'var(--text-on-accent)', display: 'grid', placeItems: 'center', font: 'var(--weight-black) 40px/1 var(--font-ar)', boxShadow: 'var(--glow-citron)' }}>✓</div>
        <div style={{ ...hero }}>وصلت.</div>
        <p style={{ font: 'var(--type-body)', color: 'var(--text-2)' }}>{owner} رح يقرأها وما بيعرف مين إنت. إذا حب يعرف، لازم يصارحك بدوره.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Button variant="primary" block>اعمل رابطك إنت كمان</Button>
          <Button variant="ghost" block onClick={() => { setBody(''); onState && onState('ready') }}>ابعت رسالة تانية</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={faint}>عم تصارح</span>
        <span style={{ ...hero }}>{owner}</span>
      </div>
      <Notice tone="info">اسمك ما بيوصل لـ{owner}. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.</Notice>

      {state === 'ratelimit' ? <Notice tone="warning">بعتت ٥ رسائل لهاد الرابط بهي الساعة. ارتاح شوي وارجع.</Notice> : null}
      {state === 'blocked' ? <Notice tone="info">ما فينا نوصّل رسالتك لهاد الشخص هلق.</Notice> : null}

      <TextArea id="send-body" hero rows={7} value={body} onChange={setBody}
        placeholder="اكتب اللي بقلبك…" maxLength={4000} counter />

      {state === 'signin' ? (
        <Card tone="citron" pad="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ font: 'var(--type-body-strong)', color: 'var(--citron-100)' }}>لازم تسجل دخول قبل ما تبعت.</p>
          <p style={{ font: 'var(--type-caption)', color: 'var(--citron-100)', opacity: .8 }}>اللي كتبته محفوظ — رح ترجع عليه بعد الدخول.</p>
          <Button variant="primary" block>تسجيل دخول بفيسبوك</Button>
        </Card>
      ) : (
        <Button variant="primary" block disabled={!body.trim() || state === 'ratelimit' || state === 'blocked'}
          onClick={() => { onSend && onSend(); onState && onState('sent') }}>ابعت</Button>
      )}
      <div style={{ ...faint, textAlign: 'center' }}>٥ رسائل بالساعة لنفس الرابط · ٣٠ باليوم</div>
    </div>
  )
}

const SENT = [
  { id: 's1', to: 'ليلى', body: 'ما قدرت قلك وجهاً لوجه، فبعتلك هون.', day: 'اليوم', hour: 3, meridiem: 'ص', offer: 'pending' },
  { id: 's2', to: 'كريم', body: 'كنت محق وأنا كنت غلطان بهداك اليوم.', day: 'أمس', hour: 10, meridiem: 'م', offer: null },
  { id: 's3', to: 'ندى', body: 'شكراً لأنك ضلّيت، ولو ما عرفتي مين أنا.', day: '٢٧ آب', hour: 8, meridiem: 'م', offer: 'declined' }
]

function SentList({ empty = false, onOpenOffer }) {
  return (
    <div style={{ ...page, paddingTop: 'var(--space-4)' }}>
      <div style={h1}>يلي بعتها</div>
      {empty ? (
        <EmptyState glyph="question" title="لسا ما بعتّ شي"
          body="لما حدا يشاركك رابطو، فيك تحكي معه بصراحة وما بيعرف مين إنت." />
      ) : SENT.map((m) => (
        <Card key={m.id} bubble style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>لـ {m.to}</span>
            <HourStamp day={m.day} hour={m.hour} meridiem={m.meridiem} />
          </div>
          <p style={{ font: 'var(--type-body)', color: 'var(--text-1)' }}>{m.body}</p>
          {m.offer === 'pending' ? (
            <div style={{ background: 'var(--rose-wash)', border: '1px solid rgba(227,155,168,.3)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ font: 'var(--type-body-strong)', color: 'var(--rose-100)' }}>{m.to} بدها تعرف مين إنت.</span>
              <Button variant="reveal" size="md" onClick={onOpenOffer}>شوف العرض</Button>
            </div>
          ) : null}
          {m.offer === 'declined' ? <StateChip state="declined" label="ما وافقت على المصارحة" /> : null}
        </Card>
      ))}
    </div>
  )
}

Object.assign(window, { SendPage, SentList, SENT })
