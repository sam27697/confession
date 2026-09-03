export interface StateChipProps {
  /** Confession status (delivered / hidden / reported) or reveal-offer state (pending / resolved / declined / cancelled). */
  state?: 'delivered' | 'hidden' | 'reported' | 'pending' | 'resolved' | 'declined' | 'cancelled'
  /** Override the Arabic label. Rarely needed — the state carries its own copy. */
  label?: string
  style?: React.CSSProperties
}

/** Small dot + Arabic label pill describing where a message or an offer stands. */
export declare function StateChip(props: StateChipProps): JSX.Element
