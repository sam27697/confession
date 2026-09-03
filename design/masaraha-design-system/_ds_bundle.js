/* @ds-bundle: {"format":4,"namespace":"MasarahaDesignSystem_b05309","components":[{"name":"AppHeader","sourcePath":"components/app/AppHeader.jsx"},{"name":"HourStamp","sourcePath":"components/app/HourStamp.jsx"},{"name":"LinkBlock","sourcePath":"components/app/LinkBlock.jsx"},{"name":"MessageCard","sourcePath":"components/app/MessageCard.jsx"},{"name":"RevealPanel","sourcePath":"components/app/RevealPanel.jsx"},{"name":"BrandMark","sourcePath":"components/brand/BrandMark.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"Notice","sourcePath":"components/core/Notice.jsx"},{"name":"StateChip","sourcePath":"components/core/StateChip.jsx"},{"name":"Toggle","sourcePath":"components/core/Toggle.jsx"},{"name":"CheckboxRow","sourcePath":"components/forms/CheckboxRow.jsx"},{"name":"TextArea","sourcePath":"components/forms/TextArea.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"}],"sourceHashes":{"components/app/AppHeader.jsx":"9d3d9f24e3ff","components/app/HourStamp.jsx":"243eddd2dbd1","components/app/LinkBlock.jsx":"2ccd80337b6f","components/app/MessageCard.jsx":"86f03cf43ee2","components/app/RevealPanel.jsx":"be02e4066908","components/brand/BrandMark.jsx":"adf87b154ab2","components/core/Button.jsx":"9eb416aede43","components/core/Card.jsx":"c6e4dc73140c","components/core/EmptyState.jsx":"e77079c2ca33","components/core/Notice.jsx":"1c5d071dbee7","components/core/StateChip.jsx":"b0bd4b4ec0cd","components/core/Toggle.jsx":"f7c4a476bde3","components/forms/CheckboxRow.jsx":"f331f9dfa713","components/forms/TextArea.jsx":"64a27f2939a3","components/forms/TextField.jsx":"60df2050d4f9","ui_kits/masaraha_admin/Admin.jsx":"f2b0e5db3fe3","ui_kits/masaraha_app/App.jsx":"e36d9b94a443","ui_kits/masaraha_app/ScreensAuth.jsx":"341cabac36af","ui_kits/masaraha_app/ScreensInbox.jsx":"60b1aeb88e52","ui_kits/masaraha_app/ScreensReveal.jsx":"6ae2992b68bc","ui_kits/masaraha_app/ScreensSend.jsx":"98681bac69f3","ui_kits/masaraha_app/Shell.jsx":"628f9cd097ff"},"inlinedExternals":[],"unexposedExports":[{"name":"toArabicDigits","sourcePath":"components/app/HourStamp.jsx"}]} */

(() => {

const __ds_ns = (window.MasarahaDesignSystem_b05309 = window.MasarahaDesignSystem_b05309 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/app/HourStamp.jsx
try { (() => {
const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, d => AR[+d]);
}

/**
 * Hour-only timestamp. Never a minute, never "منذ دقيقتين" — a minute-level
 * stamp plus knowing who was awake identifies the sender.
 */
function HourStamp({
  day = 'اليوم',
  hour = 2,
  meridiem = 'ص',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-micro)',
      color: 'var(--text-3)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, day, " ", toArabicDigits(hour), meridiem);
}
Object.assign(__ds_scope, { toArabicDigits, HourStamp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/HourStamp.jsx", error: String((e && e.message) || e) }); }

// components/brand/BrandMark.jsx
try { (() => {
/** The mark: a notched speech bubble carrying م. Drawn inline — the app ships no image files. */
function BrandMark({
  size = 40,
  tone = 'citron',
  wordmark = false,
  style
}) {
  const bg = tone === 'citron' ? 'var(--citron-500)' : tone === 'rose' ? 'var(--rose-500)' : 'var(--text-1)';
  const fg = tone === 'citron' ? 'var(--text-on-accent)' : tone === 'rose' ? 'var(--text-on-reveal)' : 'var(--ground)';
  const r = Math.round(size * 0.28);
  const notch = Math.round(size * 0.08);
  const mark = /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      flex: '0 0 auto',
      display: 'grid',
      placeItems: 'center',
      background: bg,
      color: fg,
      borderRadius: r + 'px ' + r + 'px ' + notch + 'px ' + r + 'px',
      font: 'var(--weight-black) ' + Math.round(size * 0.52) + 'px/1 var(--font-ar)',
      paddingBottom: Math.round(size * 0.04)
    }
  }, "\u0645");
  if (!wordmark) return /*#__PURE__*/React.createElement("span", {
    style: style
  }, mark);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: Math.round(size * 0.3),
      ...style
    }
  }, mark, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-black) ' + Math.round(size * 0.6) + 'px/1 var(--font-ar)',
      color: 'var(--text-1)'
    }
  }, "\u0645\u0635\u0627\u0631\u062D\u0629"));
}
Object.assign(__ds_scope, { BrandMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/BrandMark.jsx", error: String((e && e.message) || e) }); }

// components/app/AppHeader.jsx
try { (() => {
/** Sticky glass header. Two destinations, never more. */
function AppHeader({
  active = 'inbox',
  onNavigate,
  signedIn = true,
  plain = false,
  style
}) {
  const items = plain ? [{
    id: 'admin',
    label: 'لوحة الإدارة'
  }, {
    id: 'reports',
    label: 'البلاغات'
  }] : [{
    id: 'inbox',
    label: 'صندوقك'
  }, {
    id: 'sent',
    label: 'يلي بعتها'
  }];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      padding: '12px var(--gutter)',
      background: plain ? 'var(--surface-1)' : 'var(--glass-bg)',
      backdropFilter: plain ? undefined : 'var(--glass-blur)',
      WebkitBackdropFilter: plain ? undefined : 'var(--glass-blur)',
      borderBottom: '1px solid var(--line)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BrandMark, {
    size: 32,
    tone: plain ? 'light' : 'citron',
    wordmark: !plain,
    style: {
      flex: '0 0 auto'
    }
  }), plain ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, "\u0625\u062F\u0627\u0631\u0629") : null, signedIn ? /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 'var(--space-1)'
    }
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    type: "button",
    onClick: () => onNavigate && onNavigate(it.id),
    style: {
      background: active === it.id ? 'var(--surface-3)' : 'transparent',
      color: active === it.id ? 'var(--text-1)' : 'var(--text-2)',
      border: '1px solid ' + (active === it.id ? 'var(--line-strong)' : 'transparent'),
      borderRadius: 'var(--radius-pill)',
      padding: '9px 14px',
      minHeight: 'var(--control-h-sm)',
      font: 'var(--type-caption)',
      cursor: 'pointer',
      transition: 'var(--transition-control)'
    }
  }, it.label))) : null);
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-ar)',
  fontWeight: 'var(--weight-bold)',
  letterSpacing: 'var(--tracking-ar)',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-button)',
  cursor: 'pointer',
  transition: 'var(--transition-control)',
  textAlign: 'center',
  textDecoration: 'none',
  minHeight: 'var(--tap-min)',
  whiteSpace: 'nowrap'
};
const sizes = {
  lg: {
    height: 'var(--control-h)',
    padding: '0 26px',
    fontSize: 'var(--size-body)'
  },
  md: {
    height: '46px',
    padding: '0 20px',
    fontSize: 'var(--size-body-sm)'
  },
  sm: {
    height: 'var(--control-h-sm)',
    minHeight: 'var(--control-h-sm)',
    padding: '0 14px',
    fontSize: 'var(--size-caption)'
  }
};
const variants = {
  primary: {
    background: 'var(--action-primary)',
    color: 'var(--text-on-accent)',
    boxShadow: '0 10px 30px -14px var(--citron-glow)'
  },
  reveal: {
    background: 'var(--action-reveal)',
    color: 'var(--text-on-reveal)',
    boxShadow: '0 12px 34px -14px var(--rose-glow)'
  },
  secondary: {
    background: 'var(--surface-2)',
    color: 'var(--text-1)',
    borderColor: 'var(--line)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-2)',
    borderColor: 'transparent'
  },
  destructive: {
    background: 'transparent',
    color: 'var(--danger-500)',
    borderColor: 'var(--danger-700)'
  },
  destructiveSolid: {
    background: 'var(--danger-500)',
    color: '#1B0704',
    borderColor: 'transparent'
  }
};

/** The one action on a screen. `reveal` is reserved for صارحني بدورك. */
function Button({
  children,
  variant = 'primary',
  size = 'lg',
  block = false,
  disabled = false,
  as = 'button',
  href,
  onClick,
  type = 'button',
  style
}) {
  const Tag = as === 'a' ? 'a' : 'button';
  const s = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    width: block ? '100%' : undefined,
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : undefined,
    boxShadow: disabled ? 'none' : variants[variant].boxShadow || undefined,
    ...style
  };
  const props = Tag === 'a' ? {
    href,
    style: s,
    onClick
  } : {
    type,
    disabled,
    style: s,
    onClick
  };
  return /*#__PURE__*/React.createElement(Tag, props, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/** The base panel. `bubble` notches the bottom-leading corner so it reads as speech. */
function Card({
  children,
  bubble = false,
  raised = false,
  tone = 'default',
  pad = 'md',
  style
}) {
  const tones = {
    default: {
      background: raised ? 'var(--surface-2)' : 'var(--bg-card)',
      border: '1px solid var(--border-card)'
    },
    citron: {
      background: 'var(--citron-wash)',
      border: '1px solid rgba(214,242,91,.26)'
    },
    rose: {
      background: 'var(--rose-wash)',
      border: '1px solid rgba(227,155,168,.3)'
    },
    inset: {
      background: 'var(--bg-field)',
      border: '1px solid var(--line-faint)'
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...tones[tone],
      borderRadius: bubble ? 'var(--radius-bubble)' : 'var(--radius-card)',
      padding: pad === 'lg' ? 'var(--card-pad-lg)' : pad === 'sm' ? '12px 14px' : 'var(--card-pad)',
      boxShadow: raised ? 'var(--shadow-raised)' : 'var(--shadow-card)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
/** Not an error state — a prompt. The empty inbox is the screen that decides whether a user shares their link. */
function EmptyState({
  title,
  body,
  action,
  glyph = 'bubble',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-10) var(--space-5)',
      background: 'var(--veil-citron)',
      borderRadius: 'var(--radius-card)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: '64px',
      height: '64px',
      display: 'grid',
      placeItems: 'center',
      borderRadius: 'var(--radius-bubble)',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      color: 'var(--citron-500)',
      font: 'var(--weight-black) 28px/1 var(--font-ar)'
    }
  }, glyph === 'bubble' ? 'م' : '؟'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-subtitle)',
      color: 'var(--text-1)'
    }
  }, title), body ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-2)',
      maxWidth: '30ch'
    }
  }, body) : null, action ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-2)'
    }
  }, action) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/Notice.jsx
try { (() => {
const tones = {
  info: {
    bg: 'var(--surface-2)',
    bd: 'var(--line)',
    fg: 'var(--text-2)'
  },
  citron: {
    bg: 'var(--citron-wash)',
    bd: 'rgba(214,242,91,.26)',
    fg: 'var(--citron-100)'
  },
  rose: {
    bg: 'var(--rose-wash)',
    bd: 'rgba(227,155,168,.28)',
    fg: 'var(--rose-100)'
  },
  warning: {
    bg: 'var(--pending-wash)',
    bd: 'rgba(240,185,91,.3)',
    fg: '#F7DCA9'
  },
  danger: {
    bg: 'var(--danger-wash)',
    bd: 'rgba(255,92,77,.32)',
    fg: '#FFC9C1'
  }
};

/** A quiet block of truth: the anonymity disclosure, a rate limit, an error. */
function Notice({
  children,
  tone = 'info',
  title,
  style
}) {
  const t = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.bg,
      border: '1px solid ' + t.bd,
      borderRadius: 'var(--radius-md)',
      padding: '13px 15px',
      color: t.fg,
      font: 'var(--type-body-sm)',
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      fontWeight: 'var(--weight-bold)',
      marginBottom: '4px',
      opacity: .9
    }
  }, title) : null, children);
}
Object.assign(__ds_scope, { Notice });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Notice.jsx", error: String((e && e.message) || e) }); }

// components/core/StateChip.jsx
try { (() => {
const map = {
  delivered: {
    label: 'وصلت',
    fg: 'var(--citron-300)',
    bg: 'var(--citron-wash)',
    bd: 'rgba(214,242,91,.28)'
  },
  hidden: {
    label: 'مخبّاها',
    fg: 'var(--hidden-500)',
    bg: 'var(--hidden-wash)',
    bd: 'rgba(142,127,121,.3)'
  },
  reported: {
    label: 'تم الإبلاغ عنها',
    fg: 'var(--danger-500)',
    bg: 'var(--danger-wash)',
    bd: 'rgba(255,92,77,.3)'
  },
  pending: {
    label: 'لسا ما رد',
    fg: 'var(--pending-500)',
    bg: 'var(--pending-wash)',
    bd: 'rgba(240,185,91,.32)'
  },
  resolved: {
    label: 'انكشفوا الاتنين',
    fg: 'var(--rose-300)',
    bg: 'var(--rose-wash)',
    bd: 'rgba(227,155,168,.34)'
  },
  declined: {
    label: 'ما وافق',
    fg: 'var(--text-2)',
    bg: 'var(--surface-2)',
    bd: 'var(--line)'
  },
  cancelled: {
    label: 'انسحب العرض',
    fg: 'var(--text-3)',
    bg: 'transparent',
    bd: 'var(--line)'
  }
};

/** Status of a confession or a reveal offer. Label comes from the state; pass `label` only to override. */
function StateChip({
  state = 'delivered',
  label,
  style
}) {
  const t = map[state] || map.delivered;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      font: 'var(--type-caption)',
      color: t.fg,
      background: t.bg,
      border: '1px solid ' + t.bd,
      borderRadius: 'var(--radius-chip)',
      padding: '4px 11px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '6px',
      height: '6px',
      borderRadius: '999px',
      background: t.fg,
      opacity: .9
    }
  }), label || t.label);
}
Object.assign(__ds_scope, { StateChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StateChip.jsx", error: String((e && e.message) || e) }); }

// components/app/MessageCard.jsx
try { (() => {
/**
 * One received confession. There is no sender, no avatar and no name here by
 * design — the card is composed so the absence reads as intentional.
 */
function MessageCard({
  body,
  day = 'اليوم',
  hour = 2,
  meridiem = 'ص',
  status = 'delivered',
  offerState,
  truncate = false,
  expanded = false,
  onExpand,
  actions,
  children,
  style
}) {
  const dim = status === 'hidden';
  return /*#__PURE__*/React.createElement("article", {
    style: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-bubble)',
      padding: 'var(--card-pad)',
      boxShadow: 'var(--shadow-card)',
      opacity: dim ? 0.62 : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--weight-medium) var(--size-subtitle)/1.65 var(--font-ar)',
      color: 'var(--text-1)',
      margin: 0,
      ...(truncate && !expanded ? {
        display: '-webkit-box',
        WebkitLineClamp: 4,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      } : {})
    }
  }, body), truncate && !expanded ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onExpand,
    style: {
      alignSelf: 'flex-start',
      background: 'none',
      border: 'none',
      padding: '4px 0',
      color: 'var(--link)',
      font: 'var(--type-caption)',
      cursor: 'pointer'
    }
  }, "\u0643\u0645\u0651\u0644 \u0642\u0631\u0627\u0621\u0629") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.HourStamp, {
    day: day,
    hour: hour,
    meridiem: meridiem
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '1px',
      height: '12px',
      background: 'var(--line)'
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.StateChip, {
    state: status
  }), offerState ? /*#__PURE__*/React.createElement(__ds_scope.StateChip, {
    state: offerState
  }) : null), children, actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-2)',
      paddingTop: 'var(--space-3)',
      borderTop: '1px solid var(--line-faint)'
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { MessageCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/MessageCard.jsx", error: String((e && e.message) || e) }); }

// components/app/RevealPanel.jsx
try { (() => {
const row = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};
const lbl = {
  font: 'var(--type-caption)',
  color: 'var(--rose-300)'
};
const val = {
  font: 'var(--type-body-strong)',
  color: 'var(--text-1)'
};

/**
 * The reveal exchange — the emotional centre. Shows the recipient's question and
 * her stake, and on `resolved`, both answers and the sender's name.
 */
function RevealPanel({
  state = 'pending',
  question,
  stake,
  senderAnswer,
  recipientAnswer,
  senderName,
  viewpoint = 'sender',
  footer,
  style
}) {
  const resolved = state === 'resolved';
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    tone: "rose",
    pad: "lg",
    style: {
      borderRadius: 'var(--radius-xl)',
      backgroundImage: resolved ? 'var(--veil-rose)' : undefined,
      boxShadow: resolved ? 'var(--glow-rose)' : undefined,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-subtitle)',
      color: 'var(--rose-100)'
    }
  }, "\u0635\u0627\u0631\u062D\u0646\u064A \u0628\u062F\u0648\u0631\u0643"), /*#__PURE__*/React.createElement(__ds_scope.StateChip, {
    state: state
  })), resolved && senderName ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 'var(--space-4) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--rose-300)',
      marginBottom: '6px'
    }
  }, "\u064A\u0644\u064A \u0628\u0639\u062A\u0644\u0643"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-display)',
      color: 'var(--text-1)'
    }
  }, senderName)) : null, question ? /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: lbl
  }, viewpoint === 'sender' ? 'شو بدها تعرف' : 'شو سألتو'), /*#__PURE__*/React.createElement("span", {
    style: val
  }, question)) : null, stake ? /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: lbl
  }, viewpoint === 'sender' ? 'شو رح تحكيلك عن حالها' : 'شو حكيتلو عن حالك'), /*#__PURE__*/React.createElement("span", {
    style: val
  }, stake)) : null, resolved ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '1px',
      background: 'rgba(227,155,168,.24)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: lbl
  }, "\u062C\u0648\u0627\u0628\u0647"), /*#__PURE__*/React.createElement("span", {
    style: val
  }, senderAnswer)), /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: lbl
  }, "\u062C\u0648\u0627\u0628\u0643"), /*#__PURE__*/React.createElement("span", {
    style: val
  }, recipientAnswer))) : null, state === 'pending' ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--rose-100)',
      opacity: .8
    }
  }, "\u0645\u0627 \u062D\u062F\u0627 \u0628\u064A\u0634\u0648\u0641 \u062C\u0648\u0627\u0628 \u0627\u0644\u062A\u0627\u0646\u064A \u0642\u0628\u0644 \u0645\u0627 \u064A\u0646\u0632\u0644\u0648\u0627 \u0627\u0644\u0627\u062A\u0646\u064A\u0646 \u0633\u0648\u0627.") : null, state === 'declined' ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-2)'
    }
  }, "\u0645\u0627 \u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u0631\u062D\u0629. \u062C\u0648\u0627\u0628\u0643 \u0636\u0644\u0651 \u0639\u0646\u062F\u0643 \u0648\u0645\u0627 \u062D\u062F\u0627 \u0634\u0627\u0641\u0648.") : null, state === 'cancelled' ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-2)'
    }
  }, "\u0627\u0646\u0633\u062D\u0628 \u0639\u0631\u0636 \u0627\u0644\u0645\u0635\u0627\u0631\u062D\u0629.") : null, footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      flexWrap: 'wrap'
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { RevealPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/RevealPanel.jsx", error: String((e && e.message) || e) }); }

// components/core/Toggle.jsx
try { (() => {
/** The link on/off switch. Label sits before it; the whole row is the tap target. */
function Toggle({
  checked = false,
  onChange,
  label,
  hint,
  id
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      minHeight: 'var(--tap-min)',
      cursor: 'pointer',
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-body-strong)',
      color: 'var(--text-1)'
    }
  }, label) : null, hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, hint) : null), /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      flex: '0 0 auto',
      width: '54px',
      height: '32px',
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--citron-500)' : 'var(--surface-3)',
      border: '1px solid ' + (checked ? 'var(--citron-700)' : 'var(--line)'),
      boxShadow: checked ? '0 8px 24px -12px var(--citron-glow)' : 'var(--shadow-press)',
      transition: 'background-color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '3px',
      width: '24px',
      height: '24px',
      borderRadius: '999px',
      background: checked ? 'var(--text-on-accent)' : 'var(--text-2)',
      right: checked ? '3px' : '25px',
      transition: 'right var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/app/LinkBlock.jsx
try { (() => {
/**
 * The growth loop. The user's personal link, a copy action, a share action and
 * the on/off switch. Gets the most visual weight on /inbox.
 */
function LinkBlock({
  origin = 'confession.fayad.app/c/',
  slug = 'k7m2xq9had4v',
  enabled = true,
  copied = false,
  onCopy,
  onShare,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface-1)',
      backgroundImage: 'var(--veil-citron)',
      border: '1px solid var(--line-strong)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--card-pad-lg)',
      boxShadow: 'var(--shadow-raised)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--citron-300)'
    }
  }, "\u0631\u0627\u0628\u0637\u0643"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-micro)',
      color: 'var(--text-3)'
    }
  }, enabled ? 'شغال' : 'مطفي')), /*#__PURE__*/React.createElement("div", {
    dir: "ltr",
    style: {
      background: 'var(--bg-field)',
      border: '1px dashed var(--line-strong)',
      borderRadius: 'var(--radius-field)',
      padding: '14px 16px',
      font: 'var(--type-slug)',
      letterSpacing: 'var(--tracking-latin)',
      color: 'var(--text-2)',
      wordBreak: 'break-all',
      textAlign: 'left',
      opacity: enabled ? 1 : 0.5
    }
  }, origin, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--citron-500)',
      fontWeight: 'var(--weight-bold)'
    }
  }, slug)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "md",
    onClick: onCopy,
    style: {
      flex: 1
    }
  }, copied ? 'تنسّخ ✓' : 'انسخ الرابط'), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "md",
    onClick: onShare,
    style: {
      flex: 1
    }
  }, "\u0634\u0627\u0631\u0643")), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 'var(--space-2)',
      borderTop: '1px solid var(--line-faint)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Toggle, {
    id: "link-enabled",
    checked: enabled,
    onChange: onToggle,
    label: "\u0627\u0644\u0631\u0627\u0628\u0637 \u0634\u063A\u0627\u0644",
    hint: enabled ? 'الناس تقدر تبعتلك هلق.' : 'ما حدا يقدر يبعتلك لحد ما تشغلو.'
  })));
}
Object.assign(__ds_scope, { LinkBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/LinkBlock.jsx", error: String((e && e.message) || e) }); }

// components/forms/CheckboxRow.jsx
try { (() => {
/** A consent line the user has to tick. The onboarding age gate is two of these. */
function CheckboxRow({
  id,
  checked = false,
  onChange,
  children,
  strong = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'flex-start',
      minHeight: 'var(--tap-min)',
      padding: '10px 12px',
      cursor: 'pointer',
      background: checked ? 'var(--citron-wash)' : 'var(--surface-2)',
      border: '1px solid ' + (checked ? 'rgba(214,242,91,.3)' : 'var(--line)'),
      borderRadius: 'var(--radius-field)',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: '0 0 auto',
      width: '24px',
      height: '24px',
      marginTop: '3px',
      borderRadius: 'var(--radius-xs)',
      display: 'grid',
      placeItems: 'center',
      background: checked ? 'var(--citron-500)' : 'transparent',
      border: '1px solid ' + (checked ? 'var(--citron-500)' : 'var(--line-strong)'),
      color: 'var(--text-on-accent)',
      font: 'var(--weight-black) 14px/1 var(--font-latin)'
    }
  }, checked ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      font: strong ? 'var(--type-body-strong)' : 'var(--type-body-sm)',
      color: checked ? 'var(--text-1)' : 'var(--text-2)'
    }
  }, children));
}
Object.assign(__ds_scope, { CheckboxRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/CheckboxRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextArea.jsx
try { (() => {
/** The writing area. On the public send page it is the screen's centre of gravity. */
function TextArea({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength = 4000,
  counter = true,
  hero = false,
  error,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("textarea", {
    id: id,
    rows: rows,
    value: value,
    placeholder: placeholder,
    maxLength: maxLength,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      width: '100%',
      resize: 'none',
      background: 'var(--bg-field)',
      color: 'var(--text-1)',
      border: '1px solid ' + (error ? 'var(--danger-700)' : 'var(--border-field)'),
      borderRadius: hero ? 'var(--radius-bubble)' : 'var(--radius-field)',
      font: hero ? 'var(--weight-medium) var(--size-subtitle)/1.7 var(--font-ar)' : 'var(--type-body)',
      padding: hero ? '18px' : '14px 15px',
      outline: 'none',
      transition: 'var(--transition-control)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-3)'
    }
  }, error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--danger-500)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-3)'
    }
  }, hint) : /*#__PURE__*/React.createElement("span", null), counter ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-micro)',
      color: 'var(--text-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, (value || '').length, "/", maxLength) : null));
}
Object.assign(__ds_scope, { TextArea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextArea.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
const shell = {
  width: '100%',
  background: 'var(--bg-field)',
  color: 'var(--text-1)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-field)',
  font: 'var(--type-body)',
  padding: '0 15px',
  height: 'var(--control-h)',
  transition: 'var(--transition-control)',
  outline: 'none'
};

/** Single-line field: the reveal question, the stake, the report reason, an admin username. */
function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  error,
  counter,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: type,
    value: value,
    placeholder: placeholder,
    maxLength: maxLength,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      ...shell,
      borderColor: error ? 'var(--danger-700)' : 'var(--border-field)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-3)'
    }
  }, error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--danger-500)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-3)'
    }
  }, hint) : /*#__PURE__*/React.createElement("span", null), counter && maxLength ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-micro)',
      color: 'var(--text-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, (value || '').length, "/", maxLength) : null));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_admin/Admin.jsx
try { (() => {
const {
  Button,
  Card,
  Notice,
  StateChip,
  TextField,
  TextArea,
  BrandMark,
  AppHeader,
  HourStamp,
  toArabicDigits
} = window.MasarahaDesignSystem_b05309;
const wrap = {
  maxWidth: '820px',
  margin: '0 auto',
  padding: '24px var(--gutter-desktop) 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)'
};
const title = {
  font: 'var(--type-title)',
  color: 'var(--text-1)'
};
const meta = {
  font: 'var(--type-micro)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-3)'
};
const QUEUE = [{
  id: 'c1f8',
  body: 'رسالة فيها تهديد مباشر لشخص باسمه ورقم تلفونو.',
  day: 'اليوم',
  hour: 3,
  meridiem: 'ص',
  status: 'reported',
  reason: 'تهديد ونشر معلومات شخصية'
}, {
  id: 'a09d',
  body: 'كلام مؤذي متكرر لنفس الشخص أكتر من مرة.',
  day: 'اليوم',
  hour: 1,
  meridiem: 'ص',
  status: 'reported',
  reason: 'تحرّش'
}, {
  id: '77bc',
  body: 'رسالة عادية انبلغ عنها بالغلط.',
  day: 'أمس',
  hour: 11,
  meridiem: 'م',
  status: 'delivered',
  reason: 'مش مناسب'
}];

/** The reason field IS the wall. Under 8 characters, the reveal button does not exist as a usable control. */
function RevealAction({
  id
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [done, setDone] = React.useState(false);
  const ok = reason.trim().length >= 8;
  if (done) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--danger-wash)',
        border: '1px solid rgba(255,92,77,.32)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--type-caption)',
        color: 'var(--danger-500)'
      }
    }, "\u0627\u0646\u0643\u0634\u0641 \u0627\u0644\u0645\u0631\u0633\u0644 \xB7 \u0627\u0646\u0633\u062C\u0644 \u0628\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062B\u0627\u0628\u062A"), /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--type-body-strong)',
        color: 'var(--text-1)'
      }
    }, "\u0633\u0627\u0645\u0631 \u0641."), /*#__PURE__*/React.createElement("span", {
      style: meta
    }, "reason: ", reason.trim()));
  }
  if (!open) return /*#__PURE__*/React.createElement(Button, {
    variant: "destructive",
    size: "sm",
    onClick: () => setOpen(true)
  }, "\u0627\u0643\u0634\u0641 \u0627\u0644\u0645\u0631\u0633\u0644\u2026");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--danger-700)',
      borderRadius: 'var(--radius-md)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement(Notice, {
    tone: "danger",
    title: "\u0647\u0627\u0644\u062E\u0637\u0648\u0629 \u0628\u062A\u0646\u0633\u062C\u0644 \u0646\u0647\u0627\u0626\u064A\u0627\u064B"
  }, "\u0643\u0634\u0641 \u0627\u0644\u0647\u0648\u064A\u0629 \u0628\u064A\u0646\u0633\u062C\u0644 \u0628\u0633\u062C\u0644 \u0645\u0627 \u064A\u0646\u062D\u0630\u0641 \u0648\u0645\u0627 \u064A\u0646\u0639\u062F\u0651\u0644: \u0645\u064A\u0646 \u0643\u0634\u0641\u060C \u0623\u064A \u0631\u0633\u0627\u0644\u0629\u060C \u0625\u064A\u0645\u062A\u0649\u060C \u0648\u0644\u064A\u0634."), /*#__PURE__*/React.createElement(TextArea, {
    id: 'rv-' + id,
    label: "\u0644\u064A\u0634 \u0639\u0645 \u062A\u0643\u0634\u0641\u0647\u061F (\u0668 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)",
    rows: 2,
    value: reason,
    onChange: setReason,
    maxLength: 500,
    hint: ok ? 'جاهز.' : 'لازم سبب مكتوب — مش أقل من ٨ أحرف.'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "destructiveSolid",
    size: "md",
    disabled: !ok,
    onClick: () => setDone(true)
  }, "\u0627\u0643\u0634\u0641 \u0627\u0644\u0645\u0631\u0633\u0644"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "md",
    onClick: () => {
      setOpen(false);
      setReason('');
    }
  }, "\u062E\u0644\u0635")));
}
function AdminLogin({
  onIn
}) {
  const [u, setU] = React.useState('');
  const [p, setP] = React.useState('');
  const [err, setErr] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      maxWidth: '420px',
      minHeight: '100vh',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(BrandMark, {
    size: 36,
    tone: "light"
  }), /*#__PURE__*/React.createElement("div", {
    style: title
  }, "\u062F\u062E\u0648\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"), err ? /*#__PURE__*/React.createElement(Notice, {
    tone: "danger"
  }, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629") : null, /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    id: "au",
    label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
    value: u,
    onChange: setU
  }), /*#__PURE__*/React.createElement(TextField, {
    id: "ap",
    label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631",
    type: "password",
    value: p,
    onChange: setP
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    onClick: () => u && p ? onIn() : setErr(true)
  }, "\u062F\u062E\u0648\u0644")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-3)'
    }
  }, "\u0643\u0644 \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062D\u062F\u0648\u062F\u0629. \u0627\u0644\u062C\u0644\u0633\u0629 \u0668 \u0633\u0627\u0639\u0627\u062A."));
}
function AdminQueue({
  view = 'messages'
}) {
  const rows = view === 'reports' ? QUEUE : QUEUE.concat([{
    id: '4e2a',
    body: 'رسالة عادية وصلت وما صار عليها شي.',
    day: 'أمس',
    hour: 8,
    meridiem: 'م',
    status: 'delivered'
  }]);
  return /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: title
  }, view === 'reports' ? 'البلاغات' : 'الرسايل'), /*#__PURE__*/React.createElement("span", {
    style: meta
  }, toArabicDigits(rows.length), " / limit 50")), /*#__PURE__*/React.createElement(Notice, {
    tone: "info"
  }, "\u0643\u0644 \u0627\u0644\u0635\u0641\u0648\u0641 \u0645\u0642\u0646\u0651\u0639\u0629. \u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0631\u0633\u0644 \u0645\u0627 \u0628\u062A\u0638\u0647\u0631 \u0625\u0644\u0627 \u0628\u0643\u0634\u0641 \u0645\u0633\u062C\u0651\u0644 \u0628\u0633\u0628\u0628 \u0645\u0643\u062A\u0648\u0628."), rows.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: meta,
    dir: "ltr"
  }, "#", r.id), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(HourStamp, {
    day: r.day,
    hour: r.hour,
    meridiem: r.meridiem
  }), /*#__PURE__*/React.createElement(StateChip, {
    state: r.status === 'reported' ? 'reported' : 'delivered'
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-1)'
    }
  }, r.body), r.reason && view === 'reports' ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderInlineStart: '2px solid var(--line-strong)',
      paddingInlineStart: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, "\u0633\u0628\u0628 \u0627\u0644\u0628\u0644\u0627\u063A"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-1)'
    }
  }, r.reason)) : null, /*#__PURE__*/React.createElement(RevealAction, {
    id: r.id
  }))));
}
function AdminApp() {
  const [signed, setSigned] = React.useState(true);
  const [view, setView] = React.useState('reports');
  if (!signed) return /*#__PURE__*/React.createElement(AdminLogin, {
    onIn: () => setSigned(true)
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    plain: true,
    active: view === 'reports' ? 'reports' : 'admin',
    onNavigate: id => setView(id === 'reports' ? 'reports' : 'messages')
  }), /*#__PURE__*/React.createElement(AdminQueue, {
    view: view
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSigned(false)
  }, "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C")));
}
Object.assign(window, {
  AdminApp,
  AdminLogin,
  AdminQueue,
  RevealAction
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_admin/Admin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/App.jsx
try { (() => {
const SCREENS = [{
  id: 'landing',
  label: 'الصفحة الرئيسية'
}, {
  id: 'onboarding',
  label: 'الشروط (١٨+)'
}, {
  id: 'inbox',
  label: 'الصندوق'
}, {
  id: 'inbox-empty',
  label: 'صندوق فاضي'
}, {
  id: 'send',
  label: 'صفحة الإرسال'
}, {
  id: 'send-signin',
  label: 'إرسال · تسجيل دخول'
}, {
  id: 'send-sent',
  label: 'إرسال · وصلت'
}, {
  id: 'send-off',
  label: 'إرسال · مطفي'
}, {
  id: 'send-ratelimit',
  label: 'إرسال · الحد'
}, {
  id: 'sent',
  label: 'يلي بعتها'
}, {
  id: 'sent-empty',
  label: 'يلي بعتها · فاضي'
}, {
  id: 'offer',
  label: 'المصارحة · بانتظاره'
}, {
  id: 'offer-resolved',
  label: 'المصارحة · انكشفوا'
}, {
  id: 'offer-declined',
  label: 'المصارحة · رفض'
}, {
  id: 'offer-waiting',
  label: 'المصارحة · عم تستنى'
}, {
  id: 'delete',
  label: 'حذف الحساب'
}, {
  id: 'delete-done',
  label: 'حذف · تم'
}, {
  id: 'terms',
  label: 'الشروط'
}, {
  id: 'privacy',
  label: 'الخصوصية'
}];
function App() {
  const [screen, setScreen] = React.useState('inbox');
  const [enabled, setEnabled] = React.useState(true);
  const signedIn = !['landing', 'onboarding', 'send', 'send-signin', 'send-sent', 'send-off', 'send-ratelimit'].includes(screen);
  const nav = signedIn && !screen.startsWith('delete');
  let body = null;
  if (screen === 'landing') body = /*#__PURE__*/React.createElement(Landing, {
    onLogin: () => setScreen('onboarding')
  });else if (screen === 'onboarding') body = /*#__PURE__*/React.createElement(Onboarding, {
    onAccept: () => setScreen('inbox')
  });else if (screen === 'inbox' || screen === 'inbox-empty') body = /*#__PURE__*/React.createElement(Inbox, {
    empty: screen === 'inbox-empty',
    enabled: enabled,
    onToggle: setEnabled,
    onDelete: () => setScreen('delete')
  });else if (screen.startsWith('send')) {
    const st = screen === 'send' ? 'ready' : screen.replace('send-', '');
    body = /*#__PURE__*/React.createElement(SendPage, {
      state: st,
      onState: s => setScreen(s === 'ready' ? 'send' : 'send-' + s)
    });
  } else if (screen === 'sent' || screen === 'sent-empty') body = /*#__PURE__*/React.createElement(SentList, {
    empty: screen === 'sent-empty',
    onOpenOffer: () => setScreen('offer')
  });else if (screen === 'offer') body = /*#__PURE__*/React.createElement(OfferScreen, {
    state: "pending",
    viewpoint: "sender",
    onAccept: () => setScreen('offer-resolved'),
    onDecline: () => setScreen('offer-declined')
  });else if (screen === 'offer-resolved') body = /*#__PURE__*/React.createElement(OfferScreen, {
    state: "resolved"
  });else if (screen === 'offer-declined') body = /*#__PURE__*/React.createElement(OfferScreen, {
    state: "declined"
  });else if (screen === 'offer-waiting') body = /*#__PURE__*/React.createElement(OfferScreen, {
    state: "pending",
    viewpoint: "recipient"
  });else if (screen === 'delete') body = /*#__PURE__*/React.createElement(AccountDelete, {
    onDone: () => setScreen('delete-done')
  });else if (screen === 'delete-done') body = /*#__PURE__*/React.createElement(AccountDelete, {
    done: true
  });else body = /*#__PURE__*/React.createElement(Legal, {
    kind: screen === 'terms' ? 'terms' : 'privacy'
  });
  const veil = screen === 'landing' ? 'var(--veil-citron)' : screen.startsWith('offer') ? 'var(--veil-rose)' : screen.startsWith('send') ? 'var(--veil-citron)' : 'none';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--ground-deep)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '24px 16px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
      justifyContent: 'center',
      maxWidth: '900px'
    }
  }, SCREENS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    type: "button",
    onClick: () => setScreen(s.id),
    style: {
      background: screen === s.id ? 'var(--citron-500)' : 'var(--surface-1)',
      color: screen === s.id ? 'var(--text-on-accent)' : 'var(--text-2)',
      border: '1px solid ' + (screen === s.id ? 'var(--citron-500)' : 'var(--line)'),
      borderRadius: 'var(--radius-pill)',
      padding: '7px 12px',
      font: 'var(--type-micro)',
      cursor: 'pointer'
    }
  }, s.label))), /*#__PURE__*/React.createElement(PhoneShell, {
    veil: veil
  }, nav ? /*#__PURE__*/React.createElement(AppHeader, {
    active: screen.startsWith('sent') ? 'sent' : 'inbox',
    onNavigate: id => setScreen(id)
  }) : null, !signedIn && screen.startsWith('send') ? /*#__PURE__*/React.createElement(AppHeader, {
    signedIn: false
  }) : null, body));
}
Object.assign(window, {
  App,
  SCREENS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/ScreensAuth.jsx
try { (() => {
const CLAUSES = ['الرسائل يلي بتوصلك ما بتشوف مين باعتها. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.', 'لتبعت رسالة لازم تكون مسجّل دخول. الرسالة بتوصل بدون اسمك للمستلم، بس مربوطة بحسابك عندنا.', 'أي إساءة أو تهديد أو تحرّش أو نشر معلومات شخصية عن غيرك ممنوع، وهي مسؤوليتك الكاملة كمُستخدِم.', 'منقدر نوقف حسابك أو رابطك بدون إنذار إذا انكسرت هالقواعد.', 'الخدمة مخصصة لعمر ١٨ سنة وفوق.', 'فيك تطفّي رابطك أو تحذف حسابك بأي وقت.'];
function Landing({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      flex: 1,
      justifyContent: 'center',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(BrandMark, {
    size: 72
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...hero,
      fontSize: 'var(--size-display-xl)'
    }
  }, "\u062E\u0644\u064A\u0647\u0645", /*#__PURE__*/React.createElement("br", null), "\u064A\u0635\u0627\u0631\u062D\u0648\u0643."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-2)'
    }
  }, "\u062A\u0637\u0628\u064A\u0642 \u0645\u0635\u0627\u0631\u062D\u0629 \u0633\u0631\u064A\u0629. \u0627\u0644\u0646\u0627\u0633 \u062A\u0642\u062F\u0631 \u062A\u0628\u0639\u062A\u0644\u0643 \u0623\u064A \u0634\u064A \u0648\u0647\u064A \u0645\u062A\u062E\u0641\u064A\u0629 \u0639\u0646\u0643. \u0648\u0625\u0630\u0627 \u062D\u062F\u0627 \u062D\u0628 \u064A\u0635\u0627\u0631\u062D\u0643 \u0623\u0643\u062A\u0631\u060C \u0641\u064A\u0647 \u0645\u064A\u0632\u0629 \u0627\u0633\u0645\u0647\u0627 \xAB\u0635\u0627\u0631\u062D\u0646\u064A \u0628\u062F\u0648\u0631\u0643\xBB \u0628\u062A\u0643\u0634\u0641 \u0645\u064A\u0646 \u0647\u0648\u060C \u0628\u0633 \u0625\u0630\u0627 \u0647\u0648 \u0648\u0627\u0641\u0642."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true,
    onClick: onLogin
  }, "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0628\u0641\u064A\u0633\u0628\u0648\u0643"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      justifyContent: 'center',
      font: 'var(--type-caption)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#terms"
  }, "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062D\u0643\u0627\u0645"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-3)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("a", {
    href: "#privacy"
  }, "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629")));
}
function Onboarding({
  onAccept,
  name = 'سامر'
}) {
  const [age, setAge] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const ready = age && terms;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: h1
  }, "\u0642\u0628\u0644 \u0645\u0627 \u062A\u0628\u0644\u0651\u0634"), /*#__PURE__*/React.createElement("p", {
    style: muted
  }, "\u0623\u0647\u0644\u0627 ", name, " \u2014 \u0644\u0627\u0632\u0645 \u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0647\u0627\u0644\u0634\u0631\u0648\u0637."), /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, CLAUSES.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 0 auto',
      width: '26px',
      height: '26px',
      borderRadius: '999px',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      display: 'grid',
      placeItems: 'center',
      font: 'var(--type-micro)',
      color: 'var(--citron-300)'
    }
  }, toArabicDigits(i + 1)), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      color: i === 0 ? 'var(--text-1)' : 'var(--text-2)'
    }
  }, c)))), /*#__PURE__*/React.createElement(CheckboxRow, {
    id: "ob-age",
    strong: true,
    checked: age,
    onChange: setAge
  }, "\u0639\u0645\u0631\u064A \u0661\u0668 \u0633\u0646\u0629 \u0623\u0648 \u0623\u0643\u062B\u0631"), /*#__PURE__*/React.createElement(CheckboxRow, {
    id: "ob-terms",
    checked: terms,
    onChange: setTerms
  }, "\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062D\u0643\u0627\u0645"), !ready ? /*#__PURE__*/React.createElement("div", {
    style: faint
  }, "\u0644\u0627\u0632\u0645 \u062A\u0623\u0643\u062F \u0627\u0644\u0627\u062A\u0646\u064A\u0646.") : null, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true,
    disabled: !ready,
    onClick: onAccept
  }, "\u0645\u0648\u0627\u0641\u0642\u060C \u0641\u0648\u062A"));
}
function Legal({
  kind = 'terms'
}) {
  const items = kind === 'terms' ? CLAUSES : ['رقم حسابك واسمك من فيسبوك، لطرفي أي رسالة (المرسل والمستقبل).', 'نص الرسالة نفسها.', 'الساعة يلي انبعتت فيها الرسالة — مش الدقيقة.', 'موافقتك على الشروط والأحكام.'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: h1
  }, kind === 'terms' ? 'الشروط والأحكام' : 'سياسة الخصوصية'), /*#__PURE__*/React.createElement("p", {
    style: muted
  }, kind === 'terms' ? 'نسخة ٢٠٢٦-٠٨-٢٥' : 'هيك منخزن معلومات عنك بالظبط:'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, items.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--citron-300)',
      marginBottom: '4px'
    }
  }, kind === 'terms' ? 'المادة ' : '', toArabicDigits(i + 1)), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-1)'
    }
  }, c), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '1px',
      background: 'var(--line-faint)',
      marginTop: 'var(--space-4)'
    }
  })))), kind === 'privacy' ? /*#__PURE__*/React.createElement(Notice, {
    tone: "info"
  }, "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0641\u064A\u0647\u0627 \u062A\u0634\u0648\u0641 \u0645\u064A\u0646 \u0628\u0639\u062A \u0623\u064A \u0631\u0633\u0627\u0644\u0629\u060C \u0648\u0643\u0644 \u0645\u0631\u0629 \u062D\u062F\u0627 \u0645\u0646 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u064A\u0634\u0648\u0641 \u0647\u0627\u0644\u0634\u064A \u0628\u064A\u0646\u0633\u062C\u0644 \u0628\u0633\u062C\u0644 \u062B\u0627\u0628\u062A \u0645\u0627 \u064A\u062A\u063A\u064A\u0631.") : /*#__PURE__*/React.createElement("p", {
    style: muted
  }, "\u0628\u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \xAB\u0645\u0648\u0627\u0641\u0642\xBB \u0625\u0646\u062A \u0645\u0642\u0631\u0651 \u0625\u0646\u0643 \u0642\u0631\u0623\u062A \u0647\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0642\u0628\u0644\u062A\u0647\u0627."));
}
Object.assign(window, {
  Landing,
  Onboarding,
  Legal,
  CLAUSES
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/ScreensAuth.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/ScreensInbox.jsx
try { (() => {
const QUESTIONS = ['شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟', 'شو الشي يلي دايماً بتحس إني ما فهمته عنك؟', 'وين كنت غلطان معي وما اعترفت؟'];
const STAKES = ['رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا.', 'رح قلك الشي يلي زعلني منك وما حكيته.', 'رح قلك ليش بعدت.'];
const SEED = [{
  id: 'a',
  body: 'كنت دايماً أحسن مني بهاد الشي وما قلتلك ولا مرة. صرلي سنتين عم فكر فيها.',
  day: 'اليوم',
  hour: 2,
  meridiem: 'ص',
  status: 'delivered'
}, {
  id: 'b',
  body: 'ما بعرف كيف قلك، بس من هداك النهار يلي حكينا فيه عن أهلك، صار في شي بينا مختلف. وأنا يلي غيّرته، ما إنت. كنت خايف تحكي معي وتكتشف إني ما بستاهل هالثقة، فبعدت أنا قبل ما تبعد إنت. وهلق صرلي سنة عم حاول رجّع الشي يلي كسرته بإيدي، وما عرفت من وين أبلش، فبعتلك هون لأني ما قدرت أبعتلك بمكان تاني.',
  day: 'اليوم',
  hour: 1,
  meridiem: 'ص',
  status: 'delivered',
  long: true
}, {
  id: 'c',
  body: 'انت أحسن شي صار معي هالسنة، بس ما رح قلك مين أنا.',
  day: 'أمس',
  hour: 11,
  meridiem: 'م',
  status: 'delivered',
  offerState: 'pending'
}, {
  id: 'd',
  body: 'رسالة فيها كلام مؤذي.',
  day: 'أمس',
  hour: 9,
  meridiem: 'م',
  status: 'reported'
}, {
  id: 'e',
  body: 'خبيتها لأني ما بدي أشوفها كل مرة.',
  day: '٢٨ آب',
  hour: 4,
  meridiem: 'م',
  status: 'hidden'
}];
function OfferComposer({
  onClose,
  onSend
}) {
  const [q, setQ] = React.useState('');
  const [s, setS] = React.useState('');
  const [a, setA] = React.useState('');
  const ready = q.trim().length > 1 && s.trim().length > 1 && a.trim().length > 1;
  const chip = (t, on) => ({
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    color: on ? 'var(--rose-100)' : 'var(--text-2)',
    borderRadius: 'var(--radius-chip)',
    padding: '8px 12px',
    font: 'var(--type-caption)',
    cursor: 'pointer',
    textAlign: 'right'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-scrim)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxHeight: '92%',
      overflowY: 'auto',
      background: 'var(--surface-1)',
      backgroundImage: 'var(--veil-rose)',
      borderRadius: '28px 28px 0 0',
      borderTop: '1px solid var(--rose-700)',
      boxShadow: 'var(--shadow-sheet)',
      padding: 'var(--card-pad-lg)',
      paddingBottom: 'var(--safe-bottom)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-subtitle)',
      color: 'var(--rose-100)'
    }
  }, "\u0635\u0627\u0631\u062D\u0646\u064A \u0628\u062F\u0648\u0631\u0643"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onClose
  }, "\u0633\u0643\u0651\u0631")), /*#__PURE__*/React.createElement("p", {
    style: muted
  }, "\u0628\u062A\u062D\u0643\u064A\u0644\u0648 \u0634\u064A \u0639\u0646 \u062D\u0627\u0644\u0643\u060C \u0648\u0628\u062A\u0637\u0644\u0628 \u0645\u0646\u0647 \u0634\u064A \u0628\u0627\u0644\u0645\u0642\u0627\u0628\u0644. \u0645\u0627 \u062D\u062F\u0627 \u0628\u064A\u0634\u0648\u0641 \u062C\u0648\u0627\u0628 \u0627\u0644\u062A\u0627\u0646\u064A \u0642\u0628\u0644 \u0645\u0627 \u064A\u0646\u0632\u0644\u0648\u0627 \u0627\u0644\u0627\u062A\u0646\u064A\u0646 \u0633\u0648\u0627."), /*#__PURE__*/React.createElement(TextField, {
    id: "of-q",
    label: "\u0634\u0648 \u0628\u062F\u0643 \u062A\u0633\u0623\u0644\u0647\u061F",
    value: q,
    onChange: setQ,
    maxLength: 500,
    counter: true,
    placeholder: "\u0627\u0643\u062A\u0628 \u0633\u0624\u0627\u0644\u0643\u060C \u0623\u0648 \u0627\u062E\u062A\u0627\u0631 \u0645\u0646 \u062A\u062D\u062A"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, QUESTIONS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    style: chip(t, q === t),
    onClick: () => setQ(t)
  }, t))), /*#__PURE__*/React.createElement(TextField, {
    id: "of-s",
    label: "\u0648\u0634\u0648 \u0631\u062D \u062A\u062D\u0643\u064A\u0644\u0647 \u0639\u0646 \u062D\u0627\u0644\u0643\u061F",
    value: s,
    onChange: setS,
    maxLength: 500,
    counter: true,
    hint: "\u0644\u0627\u0632\u0645 \u064A\u0643\u0648\u0646 \u0634\u064A \u0628\u0646\u0641\u0633 \u0627\u0644\u0635\u0631\u0627\u062D\u0629. \u0647\u064A\u062F\u0627 \u064A\u0644\u064A \u0628\u064A\u062E\u0644\u064A\u0647 \u064A\u0631\u062F."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, STAKES.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    style: chip(t, s === t),
    onClick: () => setS(t)
  }, t))), /*#__PURE__*/React.createElement(TextArea, {
    id: "of-a",
    label: "\u062C\u0648\u0627\u0628\u0643 \u0627\u0644\u062D\u0642\u064A\u0642\u064A \u2014 \u064A\u0636\u0644 \u0645\u062E\u0628\u0649 \u0644\u062D\u062F \u0645\u0627 \u064A\u0648\u0627\u0641\u0642",
    rows: 3,
    value: a,
    onChange: setA,
    maxLength: 4000,
    hint: "\u062C\u0648\u0627\u0628\u0643 \u0645\u062D\u0641\u0648\u0638 \u0645\u0646 \u0647\u0644\u0642 \u0648\u0645\u0627 \u0641\u064A\u0643 \u062A\u063A\u064A\u0651\u0631\u0647 \u0628\u0639\u062F\u064A\u0646."
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "reveal",
    block: true,
    disabled: !ready,
    onClick: onSend
  }, "\u0627\u0628\u0639\u062A \u0627\u0644\u0639\u0631\u0636")));
}
function Inbox({
  empty = false,
  onDelete,
  enabled = true,
  onToggle
}) {
  const [msgs, setMsgs] = React.useState(SEED);
  const [copied, setCopied] = React.useState(false);
  const [composing, setComposing] = React.useState(null);
  const [open, setOpen] = React.useState({});
  const set = (id, patch) => setMsgs(m => m.map(x => x.id === id ? {
    ...x,
    ...patch
  } : x));
  const list = empty ? [] : msgs;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(LinkBlock, {
    enabled: enabled,
    onToggle: onToggle,
    copied: copied,
    onCopy: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: h1
  }, "\u0635\u0646\u062F\u0648\u0642\u0643"), list.length ? /*#__PURE__*/React.createElement("span", {
    style: faint
  }, toArabicDigits(list.length), " \u0631\u0633\u0627\u0626\u0644") : null), list.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "\u0635\u0646\u062F\u0648\u0642\u0643 \u0644\u0633\u0627 \u0641\u0627\u0636\u064A",
    body: "\u062D\u0637 \u0631\u0627\u0628\u0637\u0643 \u0628\u0633\u062A\u0648\u0631\u064A \u0623\u0648 \u0628\u0627\u0644\u0628\u0627\u064A\u0648. \u0623\u0648\u0644 \u0631\u0633\u0627\u0644\u0629 \u0628\u062A\u0648\u0635\u0644 \u0623\u0633\u0631\u0639 \u0645\u0645\u0627 \u062A\u062A\u062E\u064A\u0644.",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "md"
    }, "\u0634\u0627\u0631\u0643 \u0631\u0627\u0628\u0637\u0643")
  }) : list.map(m => /*#__PURE__*/React.createElement(MessageCard, {
    key: m.id,
    body: m.body,
    day: m.day,
    hour: m.hour,
    meridiem: m.meridiem,
    status: m.status,
    offerState: m.offerState,
    truncate: m.long,
    expanded: !!open[m.id],
    onExpand: () => setOpen(o => ({
      ...o,
      [m.id]: true
    })),
    actions: m.offerState ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "reveal",
      size: "sm",
      onClick: () => setComposing(m.id)
    }, "\u0635\u0627\u0631\u062D\u0646\u064A \u0628\u062F\u0648\u0631\u0643"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: () => set(m.id, {
        status: m.status === 'hidden' ? 'delivered' : 'hidden'
      })
    }, m.status === 'hidden' ? 'رجّعها' : 'خبيها'), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => set(m.id, {
        status: 'reported'
      })
    }, "\u0628\u0644\u063A"), /*#__PURE__*/React.createElement(Button, {
      variant: "destructive",
      size: "sm"
    }, "\u0627\u062D\u0638\u0631 \u0635\u0627\u062D\u0628\u0647\u0627"))
  }, m.offerState === 'pending' ? /*#__PURE__*/React.createElement(RevealPanel, {
    state: "pending",
    viewpoint: "recipient",
    question: "\u0634\u0648 \u064A\u0644\u064A \u062E\u0644\u0627\u0643 \u062A\u0628\u0639\u062A\u0644\u064A \u0647\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0647\u0644\u0642 \u0628\u0627\u0644\u0630\u0627\u062A\u061F",
    stake: "\u0631\u062D \u0642\u0644\u0643 \u0634\u0648 \u0643\u0627\u0646 \u0631\u0623\u064A\u064A \u0641\u064A\u0643 \u0628\u0627\u0644\u062D\u0642\u064A\u0642\u0629 \u0623\u0648\u0644 \u0645\u0627 \u062A\u0639\u0631\u0641\u0646\u0627.",
    footer: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm"
    }, "\u0627\u0633\u062D\u0628 \u0627\u0644\u0639\u0631\u0636")
  }) : null)), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 'var(--space-6)',
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onDelete
  }, "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628"))), composing ? /*#__PURE__*/React.createElement(OfferComposer, {
    onClose: () => setComposing(null),
    onSend: () => {
      set(composing, {
        offerState: 'pending'
      });
      setComposing(null);
    }
  }) : null);
}
function AccountDelete({
  onDone,
  done = false
}) {
  const [word, setWord] = React.useState('');
  if (done) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...page,
        flex: 1,
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--space-5)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: h1
    }, "\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643"), /*#__PURE__*/React.createElement("p", {
      style: muted
    }, "\u0627\u0646\u062D\u0630\u0641 \u0627\u0633\u0645\u0643 \u0648\u0631\u0627\u0628\u0637\u0643 \u0648\u0643\u0644 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u064A\u0644\u064A \u0648\u0635\u0644\u062A\u0643. \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u064A\u0644\u064A \u0628\u0639\u062A\u0647\u0627 \u0625\u0646\u062A \u0644\u0646\u0627\u0633 \u062A\u0627\u0646\u064A\u064A\u0646 \u0636\u0644\u0651\u062A \u0639\u0646\u062F\u0647\u0645\u060C \u0628\u062F\u0648\u0646 \u0627\u0633\u0645\u0643."), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      block: true
    }, "\u0631\u062C\u0648\u0639 \u0644\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: h1
  }, "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628"), /*#__PURE__*/React.createElement(Notice, {
    tone: "danger"
  }, "\u0647\u0627\u0644\u062E\u0637\u0648\u0629 \u0645\u0627 \u0641\u064A\u0647\u0627 \u0631\u062C\u0639\u0629. \u0645\u0627 \u0645\u0646\u0642\u062F\u0631 \u0646\u0631\u062C\u0639\u0644\u0643 \u0648\u0644\u0627 \u0631\u0633\u0627\u0644\u0629 \u0628\u0639\u062F \u0645\u0627 \u062A\u0646\u062D\u0630\u0641."), /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--danger-500)'
    }
  }, "\u064A\u0644\u064A \u0631\u062D \u064A\u0646\u062D\u0630\u0641"), ['اسمك وحسابك عنا', 'رابطك، وما حدا يقدر يستعملو بعدها', 'كل الرسائل يلي وصلتك', 'عروض المصارحة والأجوبة المرتبطة فيها'].map(t => /*#__PURE__*/React.createElement("p", {
    key: t,
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-1)'
    }
  }, t))), /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, "\u064A\u0644\u064A \u0631\u062D \u064A\u0636\u0644"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-2)'
    }
  }, "\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u064A\u0644\u064A \u0628\u0639\u062A\u0647\u0627 \u0625\u0646\u062A \u0644\u0646\u0627\u0633 \u062A\u0627\u0646\u064A\u064A\u0646 \u2014 \u0628\u062A\u0636\u0644 \u0639\u0646\u062F\u0647\u0645\u060C \u0628\u062F\u0648\u0646 \u0627\u0633\u0645\u0643."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-sm)',
      color: 'var(--text-2)'
    }
  }, "\u0633\u062C\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0641\u064A \u0643\u0634\u0641 \u0635\u0627\u0631 \u0633\u0627\u0628\u0642\u0627\u064B. \u0647\u0627\u0644\u0633\u062C\u0644 \u062B\u0627\u0628\u062A \u0648\u0645\u0627 \u0628\u064A\u0646\u062D\u0630\u0641.")), /*#__PURE__*/React.createElement(TextField, {
    id: "del",
    label: "\u0627\u0643\u062A\u0628 \xAB\u062D\u0630\u0641\xBB \u0644\u062A\u0623\u0643\u064A\u062F",
    value: word,
    onChange: setWord,
    placeholder: "\u062D\u0630\u0641"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "destructiveSolid",
    block: true,
    disabled: word.trim() !== 'حذف',
    onClick: onDone
  }, "\u0627\u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u064A \u0646\u0647\u0627\u0626\u064A\u0627\u064B"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true
  }, "\u062E\u0644\u0635\u060C \u0631\u062C\u0639\u0646\u064A"));
}
Object.assign(window, {
  Inbox,
  AccountDelete,
  OfferComposer,
  SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/ScreensInbox.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/ScreensReveal.jsx
try { (() => {
const Q = 'شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟';
const S = 'رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا.';

/** /offer/[offerId] — state: pending | resolved | declined | cancelled, viewpoint: sender | recipient */
function OfferScreen({
  state = 'pending',
  viewpoint = 'sender',
  onAccept,
  onDecline
}) {
  const [answer, setAnswer] = React.useState('');
  const resolved = state === 'resolved';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-5)',
      gap: 'var(--space-5)',
      flex: 1,
      justifyContent: resolved ? 'center' : 'flex-start'
    }
  }, !resolved ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: faint
  }, viewpoint === 'sender' ? 'وصلك عرض' : 'بعتت عرض'), /*#__PURE__*/React.createElement("span", {
    style: hero
  }, viewpoint === 'sender' ? 'حدا بدو يصارحك.' : 'عم نستنى ردّو.')) : null, state === 'pending' && viewpoint === 'sender' ? /*#__PURE__*/React.createElement(Notice, {
    tone: "rose"
  }, "\u0625\u0630\u0627 \u0648\u0627\u0641\u0642\u062A\u060C \u0627\u0633\u0645\u0643 \u0631\u062D \u064A\u0646\u0643\u0634\u0641 \u0625\u0644\u0648 \u2014 \u0648\u0628\u0633 \u0625\u0644\u0648\u060C \u0648\u0628\u0633 \u0639\u0644\u0649 \u0647\u0627\u0644\u0631\u0633\u0627\u0644\u0629.") : null, /*#__PURE__*/React.createElement(RevealPanel, {
    state: state,
    viewpoint: viewpoint,
    question: Q,
    stake: S,
    senderName: resolved ? 'سامر' : undefined,
    senderAnswer: resolved ? 'بعتتلك لأني ما بقيت أقدر أسكت، وبنفس الوقت ما كنت جاهز تعرف إني أنا.' : undefined,
    recipientAnswer: resolved ? 'أول ما تعرفنا حسيتك متكبر، وبعد شهر عرفت إنك بس خايف.' : undefined
  }), state === 'pending' && viewpoint === 'sender' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextArea, {
    id: "ans",
    label: "\u062C\u0648\u0627\u0628\u0643",
    rows: 4,
    value: answer,
    onChange: setAnswer,
    maxLength: 4000,
    hint: "\u0628\u0639\u062F \u0645\u0627 \u062A\u0628\u0639\u062A\u0648\u060C \u0645\u0627 \u0641\u064A\u0643 \u062A\u063A\u064A\u0651\u0631\u0647."
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "reveal",
    block: true,
    disabled: answer.trim().length < 2,
    onClick: onAccept
  }, "\u0648\u0627\u0641\u0642 \u0648\u062C\u0627\u0648\u0628"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true,
    onClick: onDecline
  }, "\u0644\u0623\u060C \u0645\u0648 \u0647\u0644\u0642")) : null, state === 'pending' && viewpoint === 'recipient' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: muted
  }, "\u062C\u0648\u0627\u0628\u0643 \u0645\u062D\u0641\u0648\u0638 \u0648\u0645\u0627 \u062D\u062F\u0627 \u0634\u0627\u0641\u0648. \u0625\u0630\u0627 \u0648\u0627\u0641\u0642\u060C \u0628\u062A\u0646\u0632\u0644 \u0627\u0644\u0623\u062C\u0648\u0628\u0629 \u0627\u0644\u0627\u062A\u0646\u064A\u0646 \u0633\u0648\u0627."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true
  }, "\u0627\u0633\u062D\u0628 \u0627\u0644\u0639\u0631\u0636")) : null, resolved ? /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true
  }, "\u0631\u062C\u0648\u0639 \u0644\u0644\u0635\u0646\u062F\u0648\u0642") : null, state === 'declined' ? /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true
  }, "\u0631\u062C\u0648\u0639") : null, state === 'cancelled' ? /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true
  }, "\u0631\u062C\u0648\u0639") : null);
}
Object.assign(window, {
  OfferScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/ScreensReveal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/ScreensSend.jsx
try { (() => {
/** /c/[slug] — the public send page. state: ready | signin | sent | off | ratelimit | blocked */
function SendPage({
  state = 'ready',
  owner = 'سامر',
  onSend,
  onState
}) {
  const [body, setBody] = React.useState('');
  const wrap = {
    ...page,
    flex: 1,
    paddingTop: 'var(--space-6)',
    gap: 'var(--space-5)'
  };
  if (state === 'off') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrap,
        justifyContent: 'center',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement(BrandMark, {
      size: 56,
      tone: "light",
      style: {
        alignSelf: 'center',
        opacity: .5
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: h1
    }, "\u0647\u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0637\u0641\u064A \u0647\u0644\u0642"), /*#__PURE__*/React.createElement("p", {
      style: muted
    }, "\u0635\u0627\u062D\u0628 \u0627\u0644\u0631\u0627\u0628\u0637 \u0648\u0642\u0651\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644. \u062C\u0631\u0628 \u0628\u0639\u062F\u064A\u0646."));
  }
  if (state === 'sent') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrap,
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '84px',
        height: '84px',
        alignSelf: 'center',
        borderRadius: 'var(--radius-bubble)',
        background: 'var(--citron-500)',
        color: 'var(--text-on-accent)',
        display: 'grid',
        placeItems: 'center',
        font: 'var(--weight-black) 40px/1 var(--font-ar)',
        boxShadow: 'var(--glow-citron)'
      }
    }, "\u2713"), /*#__PURE__*/React.createElement("div", {
      style: {
        ...hero
      }
    }, "\u0648\u0635\u0644\u062A."), /*#__PURE__*/React.createElement("p", {
      style: {
        font: 'var(--type-body)',
        color: 'var(--text-2)'
      }
    }, owner, " \u0631\u062D \u064A\u0642\u0631\u0623\u0647\u0627 \u0648\u0645\u0627 \u0628\u064A\u0639\u0631\u0641 \u0645\u064A\u0646 \u0625\u0646\u062A. \u0625\u0630\u0627 \u062D\u0628 \u064A\u0639\u0631\u0641\u060C \u0644\u0627\u0632\u0645 \u064A\u0635\u0627\u0631\u062D\u0643 \u0628\u062F\u0648\u0631\u0647."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      block: true
    }, "\u0627\u0639\u0645\u0644 \u0631\u0627\u0628\u0637\u0643 \u0625\u0646\u062A \u0643\u0645\u0627\u0646"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      block: true,
      onClick: () => {
        setBody('');
        onState && onState('ready');
      }
    }, "\u0627\u0628\u0639\u062A \u0631\u0633\u0627\u0644\u0629 \u062A\u0627\u0646\u064A\u0629")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: faint
  }, "\u0639\u0645 \u062A\u0635\u0627\u0631\u062D"), /*#__PURE__*/React.createElement("span", {
    style: {
      ...hero
    }
  }, owner)), /*#__PURE__*/React.createElement(Notice, {
    tone: "info"
  }, "\u0627\u0633\u0645\u0643 \u0645\u0627 \u0628\u064A\u0648\u0635\u0644 \u0644\u0640", owner, ". \u0628\u0633 \u0631\u0633\u0627\u0644\u062A\u0643 \u0645\u0631\u0628\u0648\u0637\u0629 \u0628\u062D\u0633\u0627\u0628\u0643 \u0639\u0646\u0627\u060C \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0628\u062A\u0642\u062F\u0631 \u062A\u0634\u0648\u0641\u0647."), state === 'ratelimit' ? /*#__PURE__*/React.createElement(Notice, {
    tone: "warning"
  }, "\u0628\u0639\u062A\u062A \u0665 \u0631\u0633\u0627\u0626\u0644 \u0644\u0647\u0627\u062F \u0627\u0644\u0631\u0627\u0628\u0637 \u0628\u0647\u064A \u0627\u0644\u0633\u0627\u0639\u0629. \u0627\u0631\u062A\u0627\u062D \u0634\u0648\u064A \u0648\u0627\u0631\u062C\u0639.") : null, state === 'blocked' ? /*#__PURE__*/React.createElement(Notice, {
    tone: "info"
  }, "\u0645\u0627 \u0641\u064A\u0646\u0627 \u0646\u0648\u0635\u0651\u0644 \u0631\u0633\u0627\u0644\u062A\u0643 \u0644\u0647\u0627\u062F \u0627\u0644\u0634\u062E\u0635 \u0647\u0644\u0642.") : null, /*#__PURE__*/React.createElement(TextArea, {
    id: "send-body",
    hero: true,
    rows: 7,
    value: body,
    onChange: setBody,
    placeholder: "\u0627\u0643\u062A\u0628 \u0627\u0644\u0644\u064A \u0628\u0642\u0644\u0628\u0643\u2026",
    maxLength: 4000,
    counter: true
  }), state === 'signin' ? /*#__PURE__*/React.createElement(Card, {
    tone: "citron",
    pad: "lg",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--citron-100)'
    }
  }, "\u0644\u0627\u0632\u0645 \u062A\u0633\u062C\u0644 \u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0645\u0627 \u062A\u0628\u0639\u062A."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--citron-100)',
      opacity: .8
    }
  }, "\u0627\u0644\u0644\u064A \u0643\u062A\u0628\u062A\u0647 \u0645\u062D\u0641\u0648\u0638 \u2014 \u0631\u062D \u062A\u0631\u062C\u0639 \u0639\u0644\u064A\u0647 \u0628\u0639\u062F \u0627\u0644\u062F\u062E\u0648\u0644."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true
  }, "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0628\u0641\u064A\u0633\u0628\u0648\u0643")) : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true,
    disabled: !body.trim() || state === 'ratelimit' || state === 'blocked',
    onClick: () => {
      onSend && onSend();
      onState && onState('sent');
    }
  }, "\u0627\u0628\u0639\u062A"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...faint,
      textAlign: 'center'
    }
  }, "\u0665 \u0631\u0633\u0627\u0626\u0644 \u0628\u0627\u0644\u0633\u0627\u0639\u0629 \u0644\u0646\u0641\u0633 \u0627\u0644\u0631\u0627\u0628\u0637 \xB7 \u0663\u0660 \u0628\u0627\u0644\u064A\u0648\u0645"));
}
const SENT = [{
  id: 's1',
  to: 'ليلى',
  body: 'ما قدرت قلك وجهاً لوجه، فبعتلك هون.',
  day: 'اليوم',
  hour: 3,
  meridiem: 'ص',
  offer: 'pending'
}, {
  id: 's2',
  to: 'كريم',
  body: 'كنت محق وأنا كنت غلطان بهداك اليوم.',
  day: 'أمس',
  hour: 10,
  meridiem: 'م',
  offer: null
}, {
  id: 's3',
  to: 'ندى',
  body: 'شكراً لأنك ضلّيت، ولو ما عرفتي مين أنا.',
  day: '٢٧ آب',
  hour: 8,
  meridiem: 'م',
  offer: 'declined'
}];
function SentList({
  empty = false,
  onOpenOffer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...page,
      paddingTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: h1
  }, "\u064A\u0644\u064A \u0628\u0639\u062A\u0647\u0627"), empty ? /*#__PURE__*/React.createElement(EmptyState, {
    glyph: "question",
    title: "\u0644\u0633\u0627 \u0645\u0627 \u0628\u0639\u062A\u0651 \u0634\u064A",
    body: "\u0644\u0645\u0627 \u062D\u062F\u0627 \u064A\u0634\u0627\u0631\u0643\u0643 \u0631\u0627\u0628\u0637\u0648\u060C \u0641\u064A\u0643 \u062A\u062D\u0643\u064A \u0645\u0639\u0647 \u0628\u0635\u0631\u0627\u062D\u0629 \u0648\u0645\u0627 \u0628\u064A\u0639\u0631\u0641 \u0645\u064A\u0646 \u0625\u0646\u062A."
  }) : SENT.map(m => /*#__PURE__*/React.createElement(Card, {
    key: m.id,
    bubble: true,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-2)'
    }
  }, "\u0644\u0640 ", m.to), /*#__PURE__*/React.createElement(HourStamp, {
    day: m.day,
    hour: m.hour,
    meridiem: m.meridiem
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-1)'
    }
  }, m.body), m.offer === 'pending' ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--rose-wash)',
      border: '1px solid rgba(227,155,168,.3)',
      borderRadius: 'var(--radius-md)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--rose-100)'
    }
  }, m.to, " \u0628\u062F\u0647\u0627 \u062A\u0639\u0631\u0641 \u0645\u064A\u0646 \u0625\u0646\u062A."), /*#__PURE__*/React.createElement(Button, {
    variant: "reveal",
    size: "md",
    onClick: onOpenOffer
  }, "\u0634\u0648\u0641 \u0627\u0644\u0639\u0631\u0636")) : null, m.offer === 'declined' ? /*#__PURE__*/React.createElement(StateChip, {
    state: "declined",
    label: "\u0645\u0627 \u0648\u0627\u0641\u0642\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u0631\u062D\u0629"
  }) : null)));
}
Object.assign(window, {
  SendPage,
  SentList,
  SENT
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/ScreensSend.jsx", error: String((e && e.message) || e) }); }

// ui_kits/masaraha_app/Shell.jsx
try { (() => {
const {
  Button,
  Card,
  Notice,
  StateChip,
  Toggle,
  TextField,
  TextArea,
  CheckboxRow,
  BrandMark,
  AppHeader,
  HourStamp,
  MessageCard,
  LinkBlock,
  RevealPanel,
  EmptyState,
  toArabicDigits
} = window.MasarahaDesignSystem_b05309;
const page = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: '0 var(--gutter) var(--safe-bottom)'
};
const h1 = {
  font: 'var(--type-title)',
  color: 'var(--text-1)'
};
const hero = {
  font: 'var(--type-display)',
  color: 'var(--text-1)'
};
const muted = {
  font: 'var(--type-body-sm)',
  color: 'var(--text-2)'
};
const faint = {
  font: 'var(--type-caption)',
  color: 'var(--text-3)'
};

/** 390×844 phone. Bezel is chrome for the kit, not part of the design. */
function PhoneShell({
  children,
  veil
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '390px',
      height: '844px',
      flex: '0 0 auto',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--ground)',
      backgroundImage: veil || 'none',
      backgroundRepeat: 'no-repeat',
      borderRadius: '44px',
      border: '1px solid var(--line-strong)',
      boxShadow: '0 40px 100px -40px #000'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '46px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 26px',
      font: 'var(--type-micro)',
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0669:\u0664\u0661"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .7
    }
  }, "\u25AE\u25AE\u25AE")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '798px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }
  }, children));
}
function Screen({
  label,
  children,
  veil
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: faint
  }, label), /*#__PURE__*/React.createElement(PhoneShell, {
    veil: veil
  }, children));
}
Object.assign(window, {
  PhoneShell,
  Screen,
  page,
  h1,
  hero,
  muted,
  faint,
  Button,
  Card,
  Notice,
  StateChip,
  Toggle,
  TextField,
  TextArea,
  CheckboxRow,
  BrandMark,
  AppHeader,
  HourStamp,
  MessageCard,
  LinkBlock,
  RevealPanel,
  EmptyState,
  toArabicDigits
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/masaraha_app/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.HourStamp = __ds_scope.HourStamp;

__ds_ns.LinkBlock = __ds_scope.LinkBlock;

__ds_ns.MessageCard = __ds_scope.MessageCard;

__ds_ns.RevealPanel = __ds_scope.RevealPanel;

__ds_ns.BrandMark = __ds_scope.BrandMark;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Notice = __ds_scope.Notice;

__ds_ns.StateChip = __ds_scope.StateChip;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.CheckboxRow = __ds_scope.CheckboxRow;

__ds_ns.TextArea = __ds_scope.TextArea;

__ds_ns.TextField = __ds_scope.TextField;

})();
