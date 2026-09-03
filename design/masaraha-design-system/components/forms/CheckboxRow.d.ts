export interface CheckboxRowProps {
  id?: string
  checked?: boolean
  onChange?: (next: boolean) => void
  children?: React.ReactNode
  /** Heavier text — use for the 18+ confirmation, which must not read as fine print. */
  strong?: boolean
}

/** Full-width tappable consent row. Ticked rows fill with the citron wash. */
export declare function CheckboxRow(props: CheckboxRowProps): JSX.Element
