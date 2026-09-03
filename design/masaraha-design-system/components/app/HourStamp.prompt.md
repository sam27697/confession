Hour-only timestamp — the system's one non-negotiable content rule.

```jsx
<HourStamp day="اليوم" hour={2} meridiem="ص" />   // اليوم ٢ص
<HourStamp day="أمس" hour={11} meridiem="م" />    // أمس ١١م
<HourStamp day="٢٨ آب" hour={9} meridiem="م" />
```

Never render minutes, seconds, or a relative phrase ("منذ ٢ دقيقة"). The database itself stores only `created_hour`. `toArabicDigits` is exported for counts, limits and any other number in the UI.
