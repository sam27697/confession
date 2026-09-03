export interface MessageCardProps {
  /** The confession body. The only content the recipient ever gets. */
  body: string
  day?: string
  hour?: number
  meridiem?: 'ص' | 'م'
  status?: 'delivered' | 'hidden' | 'reported'
  /** Set when a reveal offer exists on this message. */
  offerState?: 'pending' | 'resolved' | 'declined' | 'cancelled'
  /** Clamp to 4 lines with a «كمّل قراءة» control. */
  truncate?: boolean
  expanded?: boolean
  onExpand?: () => void
  /** Row of small <Button>s: صارحني بدورك، خبيها، بلغ، احظر صاحبها. */
  actions?: React.ReactNode
  /** Extra block between the meta row and the actions — e.g. the reveal panel. */
  children?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * A received message: body, hour, state. No sender, ever.
 * @startingPoint section="Inbox" subtitle="Message card with state and actions" viewport="700x260"
 */
export declare function MessageCard(props: MessageCardProps): JSX.Element
