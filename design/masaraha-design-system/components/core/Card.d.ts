export interface CardProps {
  children?: React.ReactNode
  /** Notch the bottom-leading corner (6px) so the panel reads as a spoken bubble. */
  bubble?: boolean
  raised?: boolean
  tone?: 'default' | 'citron' | 'rose' | 'inset'
  pad?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}

/** The surface every screen is built from. */
export declare function Card(props: CardProps): JSX.Element
