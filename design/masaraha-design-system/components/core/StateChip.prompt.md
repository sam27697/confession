Where a message or a reveal offer stands, as a dot-and-label pill.

```jsx
<StateChip state="delivered" />
<StateChip state="reported" />
<StateChip state="pending" />
<StateChip state="resolved" />
```

States map 1:1 to the data model: `delivered | hidden_by_recipient | reported` on a confession, `pending | resolved | declined | cancelled` on a reveal offer. Hidden and reported messages stay in the list — the chip is how they stay distinguishable instead of disappearing.
