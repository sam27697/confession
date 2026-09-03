export interface HourStampProps {
  /** «اليوم», «أمس», or an absolute day like «٢٨ آب». Never a relative phrase. */
  day?: string
  /** Hour 1–12, rendered in Arabic-Indic digits. */
  hour?: number
  /** ص (morning) or م (evening). */
  meridiem?: 'ص' | 'م'
  style?: React.CSSProperties
}

/** Hour-granularity timestamp. Minutes are a safety leak and are never rendered anywhere in this system. */
export declare function HourStamp(props: HourStampProps): JSX.Element

/** 12 → «١٢». Use for every number shown in the Arabic UI. */
export declare function toArabicDigits(n: number | string): string
