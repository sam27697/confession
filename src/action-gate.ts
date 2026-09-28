// Every server action id this build emits is 42 lowercase hex characters.
// Next itself only checks the length, and when a value fails that check it
// writes the value into the container log. The middleware uses this to turn
// anything else away before Next sees it (week 18 spec, section 1).
const ACTION_ID = /^[0-9a-f]{42}$/

export function isWellFormedActionId(value: string): boolean {
  return ACTION_ID.test(value)
}
