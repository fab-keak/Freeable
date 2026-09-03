/**
 * Generation guidance adapted from Impeccable by Paul Bakaus.
 * https://github.com/pbakaus/impeccable (Apache-2.0)
 */
export const impeccableDesignGuide = `
IMPECCABLE DESIGN STANDARD
Treat this as the quality floor for every generated page. The user's brief and supplied assets always win.

1. Choose the page's job before composing it:
- Persuade: make the value, proof, and primary action unmistakable.
- Operate: prioritize scanability, task completion, useful states, and familiar controls.
- Read: create a deliberate information hierarchy and comfortable reading rhythm.
- Experience: let the work, product, or story lead while the interface recedes.

2. Commit to a specific visual point of view:
- Derive the page from the audience's real context, culture, materials, and subject—not from generic website conventions.
- Use one coherent art direction across typography, palette, spacing, imagery, controls, and motion.
- Let the selected design system guide the result, but vary the actual composition to fit the content. Never output a recognizable canned template.
- For revisions, preserve the existing identity, behavior, content, and navigation unless the user explicitly asks for a redesign.

3. Build hierarchy through composition:
- Make the first viewport explain what this is, why it matters, and what to do next.
- Use a clear grid, intentional alignment, varied density, and more space before a section heading than after it.
- Keep body copy comfortably readable and headings balanced at every breakpoint.
- Use containers only when they clarify grouping. Avoid pages made from repetitive equal cards or cards nested inside cards.

4. Make the design feel authored:
- Use the specified display and body fonts with obvious hierarchy; do not fall back to Arial, Inter, or system defaults unless the user's brand requires them.
- Tint neutrals to the palette instead of using lifeless pure gray or black.
- Use color structurally and maintain readable contrast; never use gradient text.
- Prefer one purposeful motion idea with exponential ease-out, always honoring prefers-reduced-motion. Avoid bounce or elastic easing.
- Use real, relevant imagery when supplied or reliably available. One decisive image is better than several generic ones.
- Use a consistent icon language. Never substitute emoji or Unicode symbols for interface icons.

5. Reject common AI-design tells unless the brief explicitly calls for them:
- No decorative gradient blobs, ornamental glassmorphism, excessive pills, rounded-everything styling, or icon tiles above every heading.
- No vague hero copy, fabricated proof, fake metrics, generic testimonials, or decorative dashboards posing as content.
- No identical reveal animation on every section, hard offset shadows outside a true neobrutalist direction, or texture without a subject-specific reason.
- Do not add an eyebrow or kicker above every heading. Let headings carry the hierarchy.

6. Finish the whole experience:
- Include responsive behavior, keyboard focus, hover, active, disabled, loading, error, and empty states wherever the interface needs them.
- Style selection, focus rings, links, form controls, and scroll behavior so browser-native surfaces belong to the design.
- Keep content visible by default; animation enhances it rather than hiding it.
- Before returning the HTML, silently audit contrast, overflow, spacing, typography, working controls, mobile composition, reduced motion, and every requirement in the brief.

Add this exact marker inside <head>: <meta name="freeable-design-standard" content="impeccable-v1">
`;
