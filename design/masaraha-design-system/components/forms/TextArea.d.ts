export interface TextAreaProps {
  id?: string
  label?: string
  hint?: string
  value?: string
  onChange?: (next: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  counter?: boolean
  /** Display-size text and the notched bubble radius — for the public send page, where writing IS the screen. */
  hero?: boolean
  error?: string
  style?: React.CSSProperties
}

/** Multi-line writing area, RTL, no resize handle. */
export declare function TextArea(props: TextAreaProps): JSX.Element
