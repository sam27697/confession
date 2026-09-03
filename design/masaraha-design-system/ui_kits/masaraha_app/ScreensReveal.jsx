const Q = 'شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟'
const S = 'رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا.'

/** /offer/[offerId] — state: pending | resolved | declined | cancelled, viewpoint: sender | recipient */
function OfferScreen({ state = 'pending', viewpoint = 'sender', onAccept, onDecline }) {
  const [answer, setAnswer] = React.useState('')
  const resolved = state === 'resolved'
  return (
    <div style={{ ...page, paddingTop: 'var(--space-5)', gap: 'var(--space-5)', flex: 1, justifyContent: resolved ? 'center' : 'flex-start' }}>
      {!resolved ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={faint}>{viewpoint === 'sender' ? 'وصلك عرض' : 'بعتت عرض'}</span>
          <span style={hero}>{viewpoint === 'sender' ? 'حدا بدو يصارحك.' : 'عم نستنى ردّو.'}</span>
        </div>
      ) : null}

      {state === 'pending' && viewpoint === 'sender' ? (
        <Notice tone="rose">إذا وافقت، اسمك رح ينكشف إلو — وبس إلو، وبس على هالرسالة.</Notice>
      ) : null}

      <RevealPanel
        state={state}
        viewpoint={viewpoint}
        question={Q}
        stake={S}
        senderName={resolved ? 'سامر' : undefined}
        senderAnswer={resolved ? 'بعتتلك لأني ما بقيت أقدر أسكت، وبنفس الوقت ما كنت جاهز تعرف إني أنا.' : undefined}
        recipientAnswer={resolved ? 'أول ما تعرفنا حسيتك متكبر، وبعد شهر عرفت إنك بس خايف.' : undefined}
      />

      {state === 'pending' && viewpoint === 'sender' ? (
        <>
          <TextArea id="ans" label="جوابك" rows={4} value={answer} onChange={setAnswer} maxLength={4000}
            hint="بعد ما تبعتو، ما فيك تغيّره." />
          <Button variant="reveal" block disabled={answer.trim().length < 2} onClick={onAccept}>وافق وجاوب</Button>
          <Button variant="ghost" block onClick={onDecline}>لأ، مو هلق</Button>
        </>
      ) : null}

      {state === 'pending' && viewpoint === 'recipient' ? (
        <>
          <p style={muted}>جوابك محفوظ وما حدا شافو. إذا وافق، بتنزل الأجوبة الاتنين سوا.</p>
          <Button variant="secondary" block>اسحب العرض</Button>
        </>
      ) : null}

      {resolved ? <Button variant="secondary" block>رجوع للصندوق</Button> : null}
      {state === 'declined' ? <Button variant="ghost" block>رجوع</Button> : null}
      {state === 'cancelled' ? <Button variant="ghost" block>رجوع</Button> : null}
    </div>
  )
}

Object.assign(window, { OfferScreen })
