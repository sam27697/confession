export interface LinkBlockProps {
  /** Everything before the slug, e.g. "confession.fayad.app/c/". Rendered LTR inside the RTL page. */
  origin?: string
  /** The 12-character slug from the alphabet 23456789abcdefghjkmnpqrstuvwxyz. */
  slug?: string
  enabled?: boolean
  /** Swap the copy button to its confirmed label. */
  copied?: boolean
  onCopy?: () => void
  onShare?: () => void
  onToggle?: (next: boolean) => void
  style?: React.CSSProperties
}

/**
 * The personal-link hero on /inbox: URL well, copy + share, and the on/off switch.
 * @startingPoint section="Inbox" subtitle="Personal link, copy, share, on/off" viewport="700x330"
 */
export declare function LinkBlock(props: LinkBlockProps): JSX.Element
