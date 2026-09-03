export interface AppHeaderProps {
  active?: 'inbox' | 'sent' | 'admin' | 'reports'
  onNavigate?: (id: string) => void
  /** Hide the nav for logged-out and public pages. */
  signedIn?: boolean
  /** Operator chrome: no glass, no wordmark, light mark, admin destinations. */
  plain?: boolean
  style?: React.CSSProperties
}

/** Sticky top bar: mark + wordmark, and the two destinations a signed-in user has. */
export declare function AppHeader(props: AppHeaderProps): JSX.Element
