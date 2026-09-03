# UI kit — الإدارة (operator panel)

Same palette, none of the product's warmth. No glass, no veils, no citron primary — the operator's primary action is `secondary`, because nothing here should feel inviting.

| File | Contains |
| --- | --- |
| `index.html` | Interactive panel: `/admin` (الرسايل), `/admin/reports` (البلاغات), `/admin/login`, logout. |
| `Admin.jsx` | `AdminLogin`, `AdminQueue`, `RevealAction`. |

## The reveal is the whole design problem

`RevealAction` is the most dangerous control in the product, so it is built as a wall, not a button:

1. Collapsed, it is a small `destructive` ghost — «اكشف المرسل…».
2. Opened, it states in a danger notice that the action is written to a permanent, un-editable log.
3. The confirm button stays disabled until the written reason reaches **8 characters** (the database constraint).
4. After the reveal, the row shows the display name *and the reason that was logged*, so the operator sees their own justification recorded.

Everything else is masked by construction: report rows carry no reporter, message rows carry no sender.
