export interface BrandMarkProps {
  /** Pixel size of the square mark. 40 in the header, 96+ on the landing hero, 1024 for the app icon. */
  size?: number
  tone?: 'citron' | 'rose' | 'light'
  /** Show the wordmark مصارحة beside the mark. */
  wordmark?: boolean
  style?: React.CSSProperties
}

/**
 * The brand mark — a notched speech bubble with م. Pure CSS, no image asset.
 * @startingPoint section="Brand" subtitle="Mark, wordmark, app icon" viewport="700x150"
 */
export declare function BrandMark(props: BrandMarkProps): JSX.Element
