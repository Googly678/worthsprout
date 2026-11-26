# WorthSprout editorial standards

Applies to any task that writes, rewrites, or restructures a `reviews` article ("Best X", "A vs B", "N options compared").

Follow the skill at `.github/skills/best-x-review/SKILL.md`. The non-negotiables:

- Conclusion first: the opening paragraph names the winners, their scores, and who should buy what.
- The comparison table comes immediately after the intro and is generated from `ws_sections` (`specs` = `Label: value`, `features` = `Feature | yes|no|partial`, `price` = digits only). Never hand-write the table in body HTML.
- Five numbered H2 arguments that escalate, each with one free-commercial-use photo whose URL has been verified to return 200.
- Explain jargon inline on first use; never invent prices or competitor features; state explicitly where the sponsor is the wrong choice.
- Finish with a limits section, FAQ, and a decision-rule bottom line. Publish through the WordPress REST API and verify the live page.
