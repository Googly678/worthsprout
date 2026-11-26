---
name: best-x-review
description: Write or rewrite a WorthSprout "best X" comparison article to the house standard — conclusion-first intro, a comparison table driven by ws_sections (image, price, specs, features, score, jump link), five linked argument sections each with a licensed photo, a limits section, FAQ and bottom line — then publish to WordPress and verify the live page.
user-invocable: true
---

# Best-X comparison articles (WorthSprout house standard)

## Purpose

Produce (or rewrite) the "best X" roundup articles on worthsprout.com so they argue a point instead of listing products. The reader must learn the answer in the first 30 seconds, see the products side by side immediately after, and then be walked through linked arguments that justify the verdict.

## When to use

Use for any request to write, rewrite, or restructure a `reviews` article of the form "Best <category> <year>", "A vs B", "N options compared", or "which should I buy". Skip for single-product reviews.

Do not produce this structure as prose in chat only — the article is published content. Write the body HTML, the `ws_sections` payload, publish, and verify.

## Article structure (fixed order)

1. **Lead paragraph — conclusion first.** Name the winners with their scores, and state who should buy what in one breath. Example shape: "X wins for <job> at 9.4/10; Y is enough if <condition>; use Z if <condition> — but understand you are borrowing it, not owning it." Never open with background, definitions, or "in today's world".
2. **Second paragraph — why the obvious answer is wrong.** Name the failure mode the ranking is built around (for apps: the handoff between people; for tests: what a result can and cannot prove). This paragraph sets the spine every later section returns to.
3. **Disclosure line** (italic): partner/sponsor relationship, what was compared instead of tested, "as of <Month Year>", and a promise to say where the sponsor is the wrong choice.
4. **Comparison table** — rendered by `ComparisonTable`, not hand-written HTML. It must contain: product image, name + one-line label, price, key specs, feature checkmarks, editorial score, and a jump link to the product's section.
5. **Five numbered H2 argument sections.** Each has exactly one photo with a caption, then 2–4 paragraphs. The five sections must escalate, not repeat: (a) the real problem, (b) the best answer to it, (c) the cheapest credible alternative, (d) the constrained alternative (clinic/lab/budget), (e) the free baseline and where it breaks. Open each section with the claim, then the evidence, then the "where it falls short" sentence. Products that share a constraint (e.g. two clinic apps) share one section and one heading.
6. **"What none of these does well"** — 3–4 bullets of honest limits: no replacement for the professional's record, OCR is not magic, sharing is not exporting, leaving is part of the product.
7. **FAQ** — 4–6 `###` questions answering real objections (cheapest option, switching vets, one healthy pet, data privacy, "my clinic already uses it").
8. **Bottom line** — restate the verdict, add the "buy neither if" case, close on the decision rule, not a summary of everything.
9. **Disclosure footer** (italic) with the check date.

Headings: `H2` for sections 5–8 and the table title; `H3` for FAQ questions only. Every H2 is a numbered claim ("4. PetDesk and VitusVet: the best data you can get, and the least portable"), never a bare noun ("Products", "Conclusion").

## Writing rules

- **Say the answer, then defend it.** No suspense, no "we'll get to that".
- **Concrete failure, not adjectives.** Replace "powerful, seamless, game-changing" with the specific 11pm scene. If a sentence would survive in any competitor's blog, cut it.
- **Numbers belong to someone.** Prices, panel sizes, breed counts, review ratings: cite the vendor page or store listing and mark vendor claims as claims ("the company says", "a vendor figure"). Never invent a price or a feature for a competitor.
- **Explain jargon on first use, inline, in one clause**: "OCR — optical character recognition, so the pixels of a scanned page become editable text"; "PIMS — practice information management system, where the clinic's real chart lives"; "COI — a measure of how closely related the dog's parents were". Do not stack definitions in a glossary.
- **Comparability over completeness.** Every product row uses the same 4–5 feature names; uneven rows read as an accidental ranking.
- **Length serves the argument.** 1,500–2,500 words is normal. Cut any paragraph that does not advance, qualify, or bound the verdict.
- **Say where the sponsor loses.** At least one explicit "X is the wrong choice if…" in the sponsor's own section and one in the bottom line.
- Write in English for this site; keep the meta description to the lead sentence, trimmed to ~155 characters.

## Images

- One photo per argument section (five total), plus the table/card product images. Do not reuse one photo twice in the same article.
- Body photos must come from a free, commercial-use source. Unsplash CDN (`https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=1200&q=82`) works and can be hotlinked; Wikimedia Commons and Pexels also qualify. Do not hotlink competitor marketing art into the body.
- **Verify every image URL returns 200 before publishing.** Unsplash IDs are unpredictable: a wrong id returns 404 and the article ships with a broken figure. Check each one with a real request.
- Markup: `<figure class="wp-block-image size-large"><img src="…" alt="…" loading="lazy" /><figcaption>Caption. Photo: Unsplash.</figcaption></figure>` — no `width`/`height` attributes, `alt` describes the photo, caption connects the photo to the argument.
- Product images in the table come from `ws_sections[].image` (vendor site icon, kit photo, CMS upload). Keep them small and square; the UI letterbox fills in.

## Data contract (`ws_sections`)

The comparison table, the product cards under each heading, and the "see all picks" drawer all read one array. Never hand-type a table in the body HTML.

```json
{
  "section_heading": "2. Embark: the deepest ancestry and health screening",
  "anchor": "embark",
  "label": "Best for depth",
  "product_name": "Embark Breed + Health",
  "rating": "9.5",
  "pros": "…",
  "cons": "…",
  "image": "https://…",
  "price": "119",
  "affiliate_link": "https://…",
  "specs": "Breeds: 400+ types and varieties\nHealth: 270+ conditions\nTurnaround: 2–4 weeks",
  "features": "Breed to great-grandparent | yes\nVillage dog detection | yes\nFastest turnaround | no"
}
```

- `section_heading` must equal the body `H2` text **or** `anchor` must equal that H2's `id`; otherwise the card is pushed to the end of the article.
- Multiple rows may share one `anchor` — every matching card renders under that heading (used for paired products).
- `specs`: 3–5 lines of `Label: value`. Keep labels short (`Price`, `Platforms`, `Health`, `Export`).
- `features`: 4–5 lines of `Feature | yes|no|partial`. Same feature names in every row. `-Name` means no, `~Name` means partial.
- `price`: digits only (`4.99`, `119`) — the table adds `$`. Non-numeric pricing (`Free with a clinic`) goes into `specs` and leaves `price` empty.
- `rating`: editorial score, 0–10, one decimal.
- Keep 5–8 rows; fewer than two rows and the table does not render.

Relevant code: [ComparisonTable.tsx](../../../components/ComparisonTable.tsx), parsing in [article.ts](../../../lib/article.ts) (`parseSpecLines`, `parseFeatureLines`, `toComparisonRows`), placement in [reviews/[slug]/page.tsx](../../../app/reviews/%5Bslug%5D/page.tsx).

## Publish and verify

1. Plugin `WorthSprout Sections` must be **≥ 1.2.1** (adds `specs`/`features`); check `GET /wp-json/wp/v2/plugins/worthsprout-sections/worthsprout-sections`.
2. Publish with one authenticated `POST /wp-json/wp/v2/reviews/<id>?context=edit` containing `content` and `ws_sections`.
3. Build the JSON body with `node`, not PowerShell: `ConvertTo-Json` mangles long strings and wraps arrays in `.value`. Write a tiny script that `JSON.stringify`s `{ content, ws_sections }` from files.
4. Confirm the response echoes `content.raw` with the expected length and `ws_sections[].specs` non-empty.
5. Wait for the Cloudflare rebuild, then check the live HTML: table rows present, a known spec string present, one anchor per row resolves to a real `id`, images return 200.
6. Run `npm run typecheck` and `npm run build` whenever the template or components changed, and clean up temp files.

## Checklist (done means all true)

- [ ] First paragraph answers the question with named winners and scores.
- [ ] Table renders with 5+ rows: image, price, specs, features, score, jump link.
- [ ] Five numbered, escalating argument sections; each has one verified photo with a caption.
- [ ] Shared-constraint products share a heading and both cards render.
- [ ] "What none of these does well", FAQ, and a decision-rule bottom line are present.
- [ ] No invented prices or features; vendor claims marked as claims; jargon explained inline.
- [ ] Sponsor's weakness stated explicitly.
- [ ] Every anchor in the table resolves on the live page; every image returns 200.
- [ ] Live page has no console errors.
