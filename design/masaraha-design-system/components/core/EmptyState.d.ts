export interface EmptyStateProps {
  title: string
  body?: string
  /** Usually a <Button>. The empty inbox's action is "share your link". */
  action?: React.ReactNode
  glyph?: 'bubble' | 'question'
  style?: React.CSSProperties
}

/** Centred prompt for an empty inbox / sent list. Treated as a feature, never as an error. */
export declare function EmptyState(props: EmptyStateProps): JSX.Element
