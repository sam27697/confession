The legal gate, one row per thing the user is agreeing to.

```jsx
<CheckboxRow id="age" strong checked={age} onChange={setAge}>عمري ١٨ سنة أو أكثر</CheckboxRow>
<CheckboxRow id="terms" checked={terms} onChange={setTerms}>موافق على الشروط والأحكام</CheckboxRow>
```

Both must be ticked before the accept button leaves its disabled state. The app deliberately stores no date of birth — this row is the only age record.
