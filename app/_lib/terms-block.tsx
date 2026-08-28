// The terms are structured data in src/terms.ts (intro, six clauses,
// closing) so that nothing can quietly re-word them on the way to a screen.
// This renders that structure and does not hold a copy of the text.
import type { TermsText } from '../../src/terms.js'

export function TermsBlock({ text, dir }: { text: TermsText; dir: 'rtl' | 'ltr' }) {
  return (
    <div className="card" dir={dir}>
      <p>{text.intro}</p>
      <ol>
        {text.clauses.map((clause, index) => (
          <li key={index}>{clause}</li>
        ))}
      </ol>
      <p>{text.closing}</p>
    </div>
  )
}
