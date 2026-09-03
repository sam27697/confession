export interface NoticeProps {
  children?: React.ReactNode
  /** info = neutral disclosure. citron = something good. rose = the reveal. warning = rate limit. danger = error, block, deletion. */
  tone?: 'info' | 'citron' | 'rose' | 'warning' | 'danger'
  title?: string
  style?: React.CSSProperties
}

/** Inline banner for disclosures, rate limits and errors. Never a floating toast. */
export declare function Notice(props: NoticeProps): JSX.Element
