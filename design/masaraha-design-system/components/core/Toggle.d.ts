export interface ToggleProps {
  checked?: boolean
  onChange?: (next: boolean) => void
  /** Arabic label, e.g. «الرابط شغال». */
  label?: string
  /** One short line under the label explaining the consequence. */
  hint?: string
  id?: string
}

/** RTL switch — knob travels right-to-left. Used for the link enabled/disabled state. */
export declare function Toggle(props: ToggleProps): JSX.Element
