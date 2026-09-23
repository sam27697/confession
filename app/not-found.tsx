import type { Metadata } from 'next'

// Week 15 §0.4. Without this file a mistyped or retired /c/ link rendered
// Next's built-in page, in English and left to right, titled «404: This page
// could not be found.», inside an Arabic right-to-left shell. The person on
// the other end of that link was trying to write to a friend; they get a
// sentence they can read and a way back to the start.
//
// Server-rendered like every screen here: the client island stays at the
// five components spec section 9 names (test/21 item 10b).

export const metadata: Metadata = {
  title: 'ما لقينا هالصفحة',
}

export default function NotFound() {
  return (
    <div className="veil enter">
      <div className="empty">
        <p>ما لقينا هالصفحة.</p>
        <p>يمكن الرابط ناقص حرف، أو صاحبه غيّره.</p>
        <a className="btn btn--secondary btn--sm" href="/">
          رجوع للبداية
        </a>
      </div>
    </div>
  )
}
