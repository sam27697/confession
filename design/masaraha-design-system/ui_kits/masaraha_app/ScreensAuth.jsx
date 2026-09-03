const CLAUSES = [
  'الرسائل يلي بتوصلك ما بتشوف مين باعتها. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.',
  'لتبعت رسالة لازم تكون مسجّل دخول. الرسالة بتوصل بدون اسمك للمستلم، بس مربوطة بحسابك عندنا.',
  'أي إساءة أو تهديد أو تحرّش أو نشر معلومات شخصية عن غيرك ممنوع، وهي مسؤوليتك الكاملة كمُستخدِم.',
  'منقدر نوقف حسابك أو رابطك بدون إنذار إذا انكسرت هالقواعد.',
  'الخدمة مخصصة لعمر ١٨ سنة وفوق.',
  'فيك تطفّي رابطك أو تحذف حسابك بأي وقت.'
]

function Landing({ onLogin }) {
  return (
    <div style={{ ...page, flex: 1, justifyContent: 'center', gap: 'var(--space-6)' }}>
      <BrandMark size={72} />
      <div style={{ ...hero, fontSize: 'var(--size-display-xl)' }}>خليهم<br />يصارحوك.</div>
      <p style={{ font: 'var(--type-body)', color: 'var(--text-2)' }}>
        تطبيق مصارحة سرية. الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.
      </p>
      <Button variant="primary" block onClick={onLogin}>تسجيل دخول بفيسبوك</Button>
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', font: 'var(--type-caption)' }}>
        <a href="#terms">الشروط والأحكام</a><span style={{ color: 'var(--text-3)' }}>·</span><a href="#privacy">سياسة الخصوصية</a>
      </div>
    </div>
  )
}

function Onboarding({ onAccept, name = 'سامر' }) {
  const [age, setAge] = React.useState(false)
  const [terms, setTerms] = React.useState(false)
  const ready = age && terms
  return (
    <div style={{ ...page, paddingTop: 'var(--space-4)' }}>
      <div style={h1}>قبل ما تبلّش</div>
      <p style={muted}>أهلا {name} — لازم توافق على هالشروط.</p>
      <Card pad="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {CLAUSES.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <span style={{ flex: '0 0 auto', width: '26px', height: '26px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', font: 'var(--type-micro)', color: 'var(--citron-300)' }}>{toArabicDigits(i + 1)}</span>
            <p style={{ font: 'var(--type-body-sm)', color: i === 0 ? 'var(--text-1)' : 'var(--text-2)' }}>{c}</p>
          </div>
        ))}
      </Card>
      <CheckboxRow id="ob-age" strong checked={age} onChange={setAge}>عمري ١٨ سنة أو أكثر</CheckboxRow>
      <CheckboxRow id="ob-terms" checked={terms} onChange={setTerms}>موافق على الشروط والأحكام</CheckboxRow>
      {!ready ? <div style={faint}>لازم تأكد الاتنين.</div> : null}
      <Button variant="primary" block disabled={!ready} onClick={onAccept}>موافق، فوت</Button>
    </div>
  )
}

function Legal({ kind = 'terms' }) {
  const items = kind === 'terms' ? CLAUSES : [
    'رقم حسابك واسمك من فيسبوك، لطرفي أي رسالة (المرسل والمستقبل).',
    'نص الرسالة نفسها.',
    'الساعة يلي انبعتت فيها الرسالة — مش الدقيقة.',
    'موافقتك على الشروط والأحكام.'
  ]
  return (
    <div style={{ ...page, paddingTop: 'var(--space-4)' }}>
      <div style={h1}>{kind === 'terms' ? 'الشروط والأحكام' : 'سياسة الخصوصية'}</div>
      <p style={muted}>{kind === 'terms' ? 'نسخة ٢٠٢٦-٠٨-٢٥' : 'هيك منخزن معلومات عنك بالظبط:'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {items.map((c, i) => (
          <div key={i}>
            <div style={{ font: 'var(--type-caption)', color: 'var(--citron-300)', marginBottom: '4px' }}>{kind === 'terms' ? 'المادة ' : ''}{toArabicDigits(i + 1)}</div>
            <p style={{ font: 'var(--type-body)', color: 'var(--text-1)' }}>{c}</p>
            <div style={{ height: '1px', background: 'var(--line-faint)', marginTop: 'var(--space-4)' }}></div>
          </div>
        ))}
      </div>
      {kind === 'privacy' ? (
        <Notice tone="info">إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت ما يتغير.</Notice>
      ) : (
        <p style={muted}>بالضغط على «موافق» إنت مقرّ إنك قرأت هالشروط وقبلتها.</p>
      )}
    </div>
  )
}

Object.assign(window, { Landing, Onboarding, Legal, CLAUSES })
