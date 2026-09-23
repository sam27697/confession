import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORY_CARD = path.join(REPO_ROOT, 'app', '_components', 'StoryCard.tsx')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): StoryCard accepts optional reactionText prop and handles reaction canvas drawing with line limits', () => {
  assert.ok(existsSync(STORY_CARD), 'StoryCard.tsx must exist')
  const src = readFileSync(STORY_CARD, 'utf8')

  assert.match(
    src,
    /reactionText\??:\s*string/,
    'StoryCard must accept optional reactionText prop',
  )

  assert.match(
    src,
    /(?:وصلني اعتراف بالسر|اعتراف سري)/,
    'Canvas drawing logic must include title for confession reactions',
  )

  // Address PE-01: truncation/line limiting for long confessions on canvas
  assert.match(
    src,
    /(?:slice|substring|maxLines|\.\.\.)/,
    'Canvas drawing logic must handle long confession text safely with line limits or truncation',
  )
})

test('AC2 (NEW): Inbox confession card renders a 1-tap reaction story card trigger', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    src,
    /<StoryCard[\s\S]*?reactionText=\{m\.body\}[\s\S]*?\/>/,
    'Inbox confession items must render StoryCard with reactionText set to message body',
  )

  assert.match(
    src,
    /(?:شارك ردك بالستوري|كارت الرد)/,
    'Inbox confession items must provide reaction story trigger button label',
  )
})

test('AC3 (KEEP): Profile linkblock retains standard prompt StoryCard without reactionText', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    src,
    /<StoryCard\s+url=\{`\$\{env\.appOrigin\}\/c\/\$\{link\.slug\}`\}\s+slug=\{link\.slug\}\s*\/>/,
    'Profile linkblock must keep standard StoryCard invocation without reactionText',
  )
})

test('AC4 (KEEP): human_checklist.md includes HC-24 for story reaction card verification', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-24/, 'human_checklist.md must define HC-24')
})
