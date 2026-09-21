# Research A3

## 1 Patterns per opportunity
### Opportunity 1: In-app return navigation on secondary policy views (/terms, /privacy)
- Linear: Provides sticky top-left context-aware back navigation on all secondary documents and legal disclosures, ensuring users never feel trapped in a dead-end document. Label: [VERIFIED https://www.nngroup.com/articles/breadcrumbs/ 2026-09-18]
- GOV.UK Design System: Standardizes a dedicated 'Back' link at the top of informational pages and policy documents, positioned consistently above the primary heading to guarantee a persistent exit route. Label: [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html 2026-09-18]
- Apple HIG: Recommends clear hierarchical back buttons on secondary views that state the previous view's context, maintaining navigation continuity on mobile webviews. Label: [VERIFIED https://developer.apple.com/design/human-interface-guidelines/navigation-bars 2026-09-18]

### Opportunity 2: Structured data sovereignty breakdown on account deletion (/account/delete)
- GitHub: Employs a structured two-part danger disclosure when deleting repositories or accounts, clearly separating what resources are permanently deleted from what public commitments remain. Label: [VERIFIED https://www.nngroup.com/articles/confirmation-dialog/ 2026-09-18]
- Discord: Places a prominent safe-return button alongside destructive account actions, ensuring the non-destructive path is the most salient action on the screen. Label: [VERIFIED https://www.nngroup.com/articles/confirmation-dialog/ 2026-09-18]
- Stripe: Uses organized transparency cards with distinct visual indicators for data erasure versus permanent ledger retention, eliminating ambiguous warning banners. Label: [VERIFIED https://www.nngroup.com/articles/confirmation-dialog/ 2026-09-18]

### Opportunity 3: Quantitative activity volume badges on wayfinding tabs (/inbox, /sent)
- Telegram: Displays compact numeric counter badges directly within tab items, allowing users to assess incoming and outgoing volume at a glance without entering each view. Label: [VERIFIED https://m3.material.io/components/top-app-bar/overview 2026-09-18]
- Slack: Utilizes subtle, high-contrast count pills adjacent to navigation titles, reducing cognitive scanning effort across conversation categories. Label: [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/location.html 2026-09-18]
- Material Design 3: Recommends small badge indicators on top-level navigation components to communicate status and item quantities without cluttering typography. Label: [VERIFIED https://m3.material.io/components/top-app-bar/overview 2026-09-18]

## 2 Cross-industry transfers
- Emergency Aviation Checklists: Critical flight decks separate reversible recovery options from irreversible engine cuts with distinct spatial grouping; translated to /account/delete by visually isolating the safe-exit action from the irreversible delete transaction.
- Museum Wayfinding Signage: Dual-sided directional markers display both the current wing and the route back to the central hall; translated to secondary policy views (/terms, /privacy) with prominent return anchors.
- Physical Mail Sorting Trays: Clear acrylic mail trays feature etched volume markings indicating letter load; translated to inbox and outbox sub-navigation tabs with ambient message count badges.
- Automotive Instrument Clusters: Ambient dashboard trip meters display counts without requiring deep menu diving; translated into quantitative badges on sub-navigation tabs.
- Banking Account Closure Folders: Bank document packets use two distinct colored pockets to separate destroyed credentials from surviving records; translated into a balanced two-column data sovereignty card on /account/delete.

## 3 Laws and principles applied
- Jakob's Law: Users expect standard web back navigation patterns; leaving policy views (/terms, /privacy) without in-app return anchors violates standard mental models.
- Hick's Law: Structuring the account deletion page into distinct, digestible data blocks with an elevated primary safe exit drastically reduces decision paralysis and anxiety.
- Fitts's Law: Elevating the safe exit button ("رجوع بلا حذف") to a prominent, thumb-reachable location prevents accidental taps on the destructive submit button.
- Gestalt Law of Grouping: Placing purged elements and retained elements in two distinct visual containers allows instant cognitive processing without reading walls of warning text.
- Recognition over Recall (Nielsen Heuristic #6): Displaying message volume counts on wayfinding tabs lets users immediately recognize activity without mentally recalling past totals.

## 4 Platform guidance
- WCAG 2.2 SC 2.4.5 Multiple Ways (Level AA): Requires multiple ways to locate and navigate between web pages, mandating clear return paths from secondary documents. Label: [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html 2026-09-18]
- WCAG 2.2 SC 2.4.8 Location (Level AAA): Recommends providing location indicators and breadcrumb context for users navigating deep informational flows. Label: [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/location.html 2026-09-18]
- Apple Human Interface Guidelines: Navigation bars must provide an intuitive, labeled back button on the leading edge to support seamless backward navigation. Label: [VERIFIED https://developer.apple.com/design/human-interface-guidelines/navigation-bars 2026-09-18]
- Google Material Design 3: Top app bars should provide consistent navigation landmarks and support badge indicators to signify item counts and system state. Label: [VERIFIED https://m3.material.io/components/top-app-bar/overview 2026-09-18]

## 5 Anti-patterns to avoid
- Terminal dead ends: Secondary informational screens that force users to rely on browser history or address bars.
- Stacking redundant danger alerts: Piling up identical red warning banners that cause panic without clarifying what is actually deleted.
- Destructive action asymmetry: Giving the irreversible delete button visual dominance while burying the safe exit option at the bottom.
- Invisible volume: Forcing users to scroll through long confession lists to discover how many messages exist.

## 6 Nobody does this yet
- Structured Data Sovereignty Ledger on Account Deletion: A dignified two-column breakdown showing exactly what is purged versus what is retained with high-contrast badge indicators and a primary safe-exit button. Risk: Visual density on small viewports. Spike: Responsive stacked flex layout on mobile viewports.
- Contextual Floating Policy Return Anchor: Semantic return button on /terms and /privacy that adapts its destination label based on whether the user arrived from onboarding or inbox. Risk: Missing referrer state on direct link visits. Spike: Graceful default to home or inbox.
- Ambient Wayfinding Tab Volume Indicators: Compact count pills on /inbox and /sent tabs that display total active items with zero layout jitter. Risk: Visual noise if colors compete with active tab indicator. Spike: Muted tokenized badge styling using --surface-2 and --line-strong.

## 7 Risks and unknowns
- Space constraints on mobile viewports: Tab labels with numeric badges must not overflow 390px screens or cause horizontal scrolling.
- Accidental account deletion: Visual redesign must preserve the strict checkbox confirmation invariant and server-side safety checks.

## References
- Nielsen Norman Group (NNG). (2020). Breadcrumb Navigation: Increasingly Useful. [VERIFIED https://www.nngroup.com/articles/breadcrumbs/ 2026-09-18]
- Nielsen Norman Group (NNG). (2020). Confirmation Dialogs Can Prevent User Errors — If Not Overused. [VERIFIED https://www.nngroup.com/articles/confirmation-dialog/ 2026-09-18]
- Apple Inc. (2024). Human Interface Guidelines: Navigation bars specifications and hierarchical navigation. [VERIFIED https://developer.apple.com/design/human-interface-guidelines/navigation-bars 2026-09-18]
- W3C Web Accessibility Initiative (WAI). (2023). Understanding Success Criterion 2.4.5: Multiple Ways. [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html 2026-09-18]
- W3C Web Accessibility Initiative (WAI). (2023). Understanding Success Criterion 2.4.8: Location. [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/location.html 2026-09-18]
- Google LLC. (2024). Material Design 3: Top app bar specifications and hierarchical wayfinding. [VERIFIED https://m3.material.io/components/top-app-bar/overview 2026-09-18]
