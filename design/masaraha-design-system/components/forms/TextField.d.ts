export interface TextFieldProps {
  id?: string
  label?: string
  hint?: string
  value?: string
  onChange?: (next: string) => void
  placeholder?: string
  type?: 'text' | 'password'
  maxLength?: number
  /** Arabic error copy. Replaces the hint and reddens the border. */
  error?: string
  /** Show a `used/max` counter. On by default nowhere — opt in for the 500-char reveal fields. */
  counter?: boolean
  style?: React.CSSProperties
}

/** Single-line input, inset well, 52px tall. */
export declare function TextField(props: TextFieldProps): JSX.Element
