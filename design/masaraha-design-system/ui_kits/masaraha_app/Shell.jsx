const { Button, Card, Notice, StateChip, Toggle, TextField, TextArea, CheckboxRow, BrandMark, AppHeader, HourStamp, MessageCard, LinkBlock, RevealPanel, EmptyState, toArabicDigits } = window.MasarahaDesignSystem_b05309

const page = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: '0 var(--gutter) var(--safe-bottom)' }
const h1 = { font: 'var(--type-title)', color: 'var(--text-1)' }
const hero = { font: 'var(--type-display)', color: 'var(--text-1)' }
const muted = { font: 'var(--type-body-sm)', color: 'var(--text-2)' }
const faint = { font: 'var(--type-caption)', color: 'var(--text-3)' }

/** 390×844 phone. Bezel is chrome for the kit, not part of the design. */
function PhoneShell({ children, veil }) {
  return (
    <div style={{
      width: '390px', height: '844px', flex: '0 0 auto', position: 'relative', overflow: 'hidden',
      background: 'var(--ground)', backgroundImage: veil || 'none', backgroundRepeat: 'no-repeat',
      borderRadius: '44px', border: '1px solid var(--line-strong)', boxShadow: '0 40px 100px -40px #000'
    }}>
      <div style={{ height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', font: 'var(--type-micro)', color: 'var(--text-2)' }}>
        <span>٩:٤١</span><span style={{ opacity: .7 }}>▮▮▮</span>
      </div>
      <div style={{ height: '798px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

function Screen({ label, children, veil }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
      <div style={faint}>{label}</div>
      <PhoneShell veil={veil}>{children}</PhoneShell>
    </div>
  )
}

Object.assign(window, { PhoneShell, Screen, page, h1, hero, muted, faint, Button, Card, Notice, StateChip, Toggle, TextField, TextArea, CheckboxRow, BrandMark, AppHeader, HourStamp, MessageCard, LinkBlock, RevealPanel, EmptyState, toArabicDigits })
