# Engagement Model: Masaraha (مصارحة)

## 1. Core Loop Diagram

The engagement engine of Masaraha relies on voluntary, honest human expression, social curiosity, and reciprocal intimacy rather than algorithmic persuasion or artificial urgency.

```
+-------------------------------------------------------------------------+
|                                                                         |
|  [ TRIGGER ]                                                            |
|  - Social story link on Instagram / WhatsApp / Telegram                |
|  - Unread confession arrival notification / badge in outbox            |
|  - Curiosity about what peers truly think or wish to confess           |
|                                     |                                   |
|                                     v                                   |
|  [ ACTION ]                                                             |
|  - Compose sincere confession on /c/[slug] (or reply via mutual reveal) |
|  - Customize and publish story card / link sticker                     |
|                                     |                                   |
|                                     v                                   |
|  [ REWARD ]                                                             |
|  - Psychological catharsis of unburdening authentic thoughts           |
|  - Mutual discovery: simultaneous unmasking of identity and answers    |
|  - Social affirmation and delight at peak celebration moments           |
|                                     |                                   |
|                                     v                                   |
|  [ INVESTMENT ]                                                         |
|  - Launching personal secret box link                                  |
|  - Establishing mutual reveal stakes and questions                     |
|  - Building an archive of meaningful connections in inbox/outbox       |
|                                     |                                   |
+-------------------------------------------------------------------------+
```

### Loop Horizons
- **Moment-to-Moment:** Fluid composition -> tactile feedback -> live draft reassurance -> decisive send action -> celebration burst.
- **Session Loop:** Check inbox -> reflect on received words -> initiate or respond to mutual reveal stakes -> share updated story card -> clean graceful exit.
- **Long-Term Loop:** Cultivating a trusted, authentic channel of unvarnished communication among friends, free from public posturing, vanity counts, or algorithmic engagement traps.

---

## 2. Motivation Map (Self-Determination Theory)

Masaraha centers on intrinsic human psychological needs:

### Autonomy (Meaningful Choice)
- Total control over anonymity: Send anonymously without disclosing identity to recipient.
- Granular consent: Recipient can ignore, block sender, hide confession, or choose whether to engage in mutual reveal.
- Explicit mutual reveal contract: Identity is revealed *only* if both parties explicitly commit to their mutual question and stake; neither sees the other's answer beforehand.
- Control over presence: Ability to disable personal confession link at any time (`setLinkEnabledAction`).

### Competence (Mastery & Self-Expression)
- Frictionless composition: 1-tap suggestions and generous text boundaries enable articulate self-expression.
- Clarity of state: Clear outbox status filters (`all`, `pending`, `resolved`) give effortless oversight of communications.
- Creative presentation: Customizable story card prompts allow users to set their own tone for incoming questions.

### Relatedness (Authentic Human Connection)
- Vulnerability safely held: Deep interpersonal honesty without fear of social retaliation or public judgment.
- Reciprocal symmetry: The mutual reveal mechanism levels the playing field—both individuals share a vulnerability simultaneously.
- Zero public spectator pressure: No public follower counts, likes, or algorithmic leaderboards.

---

## 3. Octalysis Drive Check (White-Hat vs Black-Hat)

| Drive | Valence | Application in Masaraha | Health Check |
|---|---|---|---|
| 1. Epic Meaning & Calling | White-Hat | Facilitating genuine catharsis and truthful emotional expression. | Core motivation |
| 2. Development & Accomplishment | White-Hat | Resolving unanswered questions via mutual reveal unmasking. | Real progress |
| 3. Empowerment of Creativity | White-Hat | Personalizing story prompts and shaping open-ended confessions. | High autonomy |
| 4. Ownership & Possession | White-Hat / Neutral | Personal inbox and outbox history, maintained with zero cloud tracking. | Transparent |
| 5. Social Influence & Relatedness | White-Hat / Neutral | Mutual reveals and social story card sharing with friends. | Honest, peer-to-peer |
| 6. Scarcity & Impatience | Black-Hat (Strictly Restricted) | Zero fake countdowns, zero artificial wait timers, zero paying to skip queues. | BANNED / Clean |
| 7. Unpredictability & Curiosity | Black-Hat (Mild, Natural) | Natural mystery of anonymous messages and unmasking suspense. | Ethical & organic |
| 8. Loss & Avoidance | Black-Hat (Strictly Restricted) | Zero guilt trips, zero expiring messages that punish inactivity. | BANNED / Clean |

---

## 4. Flow State Architecture

- **Challenge Matched to Skill:** Writing an intimate confession is emotionally vulnerable. Suggestion prompts lower formulation anxiety while open textareas support unrestricted depth.
- **Clear Immediate Feedback:** Instant live draft indicators confirm data safety; crisp status badges (`انكشفوا الاتنين`, `لسا ما رد`, `ما وافق`) state exact offer realities.
- **Error Recovery:** Soft in-place validation anchors, draft preservation across tab reloads, and graceful handling of declined offers.

---

## 5. Honest Progress & Milestones

- **Real Progress Only:** Tracking actual mutual reveal resolution states (`pending` -> `resolved`).
- **Anti-Vanity Metric:** No arbitrary numeric levels, XP, or gamified streak maintenance. Progress is defined solely by real, resolved conversations between human beings.

---

## 6. Delight at Peak Moments & Personality

- **Peak Moments:**
  - *Post-Send Catharsis:* Celebrating message dispatch with warm cultural encouragement and an invitation to experience receiving confessions.
  - *The Unmasking Reveal:* A ceremonial, suspenseful unmasking sequence that honors the mutual courage of both participants.
- **Empty & Success States:**
  - Warm Levantine Arabic tone that feels welcoming, discreet, and comforting rather than cold or technical.
  - Contextual prompt sparks when the inbox is quiet, inviting the user to share their story link with engaging hooks.

---

## 7. Honest Reasons to Return

1. **Unread Confession Arrival:** Real communications from genuine people.
2. **Mutual Reveal Response:** Counterpart answered the question and fulfilled their stake.
3. **Draft Recovery:** Resuming an unfinished thought safely kept on the local device.
4. **Story Card Sharing:** Generating new seasonal or conversational prompts for social stories.

---

## 8. On-Device Privacy & Personalization

- Zero behavioral profiling, third-party analytics, or surveillance telemetry.
- Preferences (drafts, active filter tabs) are maintained strictly on-device in standard browser storage.
- Canvas-rendered story cards are drawn entirely client-side using computed system tokens, without sending images to external servers.

---

## 9. Session Endings (Peak-End Rule)

- Sessions conclude at natural resting points: after sending a confession, resolving an offer, or sharing a story card.
- No sticky infinite loops, autoplay, or coercive retention hooks.
- Clear exit pathways back to home, inbox, or device home screen.

---

## 10. Ethics Log

| Feature | Description | Question: "Would the user thank us for this if they fully understood how it works?" | Verdict |
|---|---|---|---|
| Mutual Reveal Contract | Both parties must submit answers before either can see the other's identity or answers. | YES. Ensures mutual symmetry and prevents asymmetric exposure. | APPROVED |
| Scoped Draft Persistence | Drafts stay in sessionStorage on-device and are wiped on successful send. | YES. Protects users from accidental work loss without leaking text to server. | APPROVED |
| On-Device Canvas Story Cards | Story cards render in browser canvas from CSS tokens and export via Web Share API or download. | YES. Fast, offline-capable, and private without cloud image generation costs or data logging. | APPROVED |
| Clean Outbox Filtering | Tab filtering on `/sent` runs purely client-side with URL search parameters. | YES. Respects user privacy and gives instant visual clarity. | APPROVED |
| Unmasking Suspense Sequence | Ceremonial CSS-driven unmasking transition when opening a resolved mutual reveal. | YES. Enhances emotional payoff of mutual vulnerability without manipulative slot-machine mechanics. | APPROVED |
| Reciprocal Box Creation Callout | Post-send card offering senders a 1-tap path to create their own secret box. | YES. Honest invitation to participate in the reciprocal social loop. | APPROVED |
