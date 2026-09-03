export interface RevealPanelProps {
  state?: 'pending' | 'resolved' | 'declined' | 'cancelled'
  /** questionForSender — what the recipient wants to know. */
  question?: string
  /** stakePrompt — what the recipient puts up in return. */
  stake?: string
  /** Only ever populated on `resolved`. */
  senderAnswer?: string
  recipientAnswer?: string
  /** Display name only. No avatar, no id, no profile link — ever. */
  senderName?: string
  /** Whose screen this is: labels flip accordingly. */
  viewpoint?: 'sender' | 'recipient'
  /** Action row — «وافق وجاوب» / «لأ، مو هلق» / «اسحب العرض». */
  footer?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * The mutual-reveal exchange, all four states, both points of view.
 * @startingPoint section="Reveal" subtitle="Pending, resolved, declined, cancelled" viewport="700x420"
 */
export declare function RevealPanel(props: RevealPanelProps): JSX.Element
