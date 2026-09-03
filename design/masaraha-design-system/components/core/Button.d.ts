export interface ButtonProps {
  children?: React.ReactNode
  /** primary = citron, the single action on a screen. reveal = dusty rose, reserved for صارحني بدورك and the exchange. destructive* = block / report / delete / admin reveal. */
  variant?: 'primary' | 'reveal' | 'secondary' | 'ghost' | 'destructive' | 'destructiveSolid'
  size?: 'lg' | 'md' | 'sm'
  /** Full-width. Use for the primary action on a mobile screen. */
  block?: boolean
  disabled?: boolean
  as?: 'button' | 'a'
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  style?: React.CSSProperties
}

/**
 * Pill button in Arabic, RTL. Never more than one `primary` per screen.
 * @startingPoint section="Core" subtitle="Primary, reveal, secondary, destructive" viewport="700x150"
 */
export declare function Button(props: ButtonProps): JSX.Element
