export type DesignTemplate = {
  id: string;
  name: string;
  summary: string;
  idealFor: string;
  keywords: string[];
  fonts: {
    display: string;
    body: string;
    googleFontsUrl: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    secondary: string;
  };
  aesthetic: string;
  layout: string;
  components: string;
  motion: string;
  imagery: string;
  avoid: string;
};

export const designTemplates: readonly DesignTemplate[] = [
  {
    id: 'editorial-luxury',
    name: 'Editorial Luxury',
    summary:
      'High-fashion restraint with oversized serif type, quiet surfaces, and one electric accent.',
    idealFor:
      'Luxury brands, boutique hotels, fashion, jewelry, galleries, wine, and premium experiences.',
    keywords: [
      'luxury',
      'fashion',
      'jewelry',
      'jewellery',
      'boutique',
      'hotel',
      'resort',
      'gallery',
      'museum',
      'wine',
      'premium',
      'editorial',
      'magazine',
      'perfume',
      'fragrance',
      'watch',
    ],
    fonts: {
      display: 'Instrument Serif',
      body: 'Manrope',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap',
    },
    colors: {
      background: '#F3F1EA',
      surface: '#FCFBF7',
      text: '#111310',
      muted: '#6B6F68',
      accent: '#CFFF00',
      secondary: '#C96F50',
    },
    aesthetic:
      'Editorial, cultured, tactile, and deliberately restrained. Pair dramatic type scale with generous negative space and precise hairline borders.',
    layout:
      'Use an asymmetric 12-column grid, cropped full-bleed imagery, large numbered sections, and an art-directed hero that feels like a magazine cover.',
    components:
      'Slim navigation, typographic hero, offset image-and-copy stories, editorial pull quotes, elegant index cards, and understated pill CTAs.',
    motion:
      'Slow image reveals, subtle text masks, and restrained 300–500ms transitions. Motion should feel cinematic rather than playful.',
    imagery:
      'Use one or two commanding photographs with intentional crops; favor warm grain, deep shadows, and real material texture.',
    avoid:
      'Generic startup cards, excessive gradients, glassmorphism, emoji, rounded-everything layouts, and crowded sections.',
  },
  {
    id: 'quiet-architecture',
    name: 'Quiet Architecture',
    summary:
      'A disciplined grid, spatial typography, and material neutrals with a precise blue signal color.',
    idealFor:
      'Architecture, interiors, real estate, furniture, construction, photography, and portfolio-led firms.',
    keywords: [
      'architecture',
      'architect',
      'interior',
      'interiors',
      'real estate',
      'property',
      'properties',
      'furniture',
      'construction',
      'builder',
      'development',
      'photographer',
      'photography',
      'portfolio',
      'landscape design',
      'industrial design',
    ],
    fonts: {
      display: 'Newsreader',
      body: 'DM Sans',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap',
    },
    colors: {
      background: '#E8E6E0',
      surface: '#F7F6F2',
      text: '#18201E',
      muted: '#717773',
      accent: '#315DFF',
      secondary: '#8B6F55',
    },
    aesthetic:
      'Architectural, exacting, and calm. Let alignment, proportion, and whitespace create the visual identity.',
    layout:
      'Use a strict modular grid, fine rules, edge-aligned captions, project numbering, and expansive horizontal image frames.',
    components:
      'Index-style navigation, project ledger, split editorial hero, metric rows, monochrome cards, and compact square controls.',
    motion:
      'Minimal fades, subtle image scaling, and deliberate hover underlines. Keep the page physically calm.',
    imagery:
      'Prioritize large structural photography with hard geometry, natural materials, and useful captions.',
    avoid:
      'Floating blobs, loud gradients, bubbly cards, generic testimonials, heavy shadows, and decorative icon overload.',
  },
  {
    id: 'modern-saas',
    name: 'Precision SaaS',
    summary:
      'A sharp product-led system with dense clarity, luminous accents, and convincing interface details.',
    idealFor:
      'AI products, SaaS, developer tools, apps, fintech, cybersecurity, platforms, and B2B software.',
    keywords: [
      'saas',
      'software',
      'startup',
      'app',
      'application',
      'ai',
      'artificial intelligence',
      'developer',
      'api',
      'platform',
      'dashboard',
      'fintech',
      'cybersecurity',
      'cloud',
      'automation',
      'productivity',
      'analytics',
      'data',
      'technology',
      'tech',
    ],
    fonts: {
      display: 'Space Grotesk',
      body: 'Inter',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
    },
    colors: {
      background: '#07100F',
      surface: '#101B19',
      text: '#F4F7F5',
      muted: '#94A29E',
      accent: '#79F2C0',
      secondary: '#7C8CFF',
    },
    aesthetic:
      'Confident, technical, and premium. Combine crisp typography with subtle luminous details and believable product UI.',
    layout:
      'Use a compact navigation, focused hero, layered product window, bento proof grid, logo row, and a strong conversion band.',
    components:
      'Product mockups with meaningful labels, status pills, terminal or dashboard fragments, metric cards, comparison rows, and precise CTAs.',
    motion:
      'Quick 160–240ms feedback, ambient glow movement, small counter or status animations, and functional hover states.',
    imagery:
      'Prefer real interface compositions, diagrams, and abstract technical textures over generic stock photography.',
    avoid:
      'Empty gradient blobs, fake 3D objects, generic feature-card repetition, vague copy, and neon on every element.',
  },
  {
    id: 'warm-craft',
    name: 'Warm Craft',
    summary:
      'Tactile hospitality with expressive serif type, earthy color, and the warmth of a neighborhood favorite.',
    idealFor:
      'Restaurants, cafés, bakeries, farms, florists, makers, breweries, and local hospitality businesses.',
    keywords: [
      'restaurant',
      'cafe',
      'café',
      'coffee',
      'bakery',
      'food',
      'chef',
      'farm',
      'artisan',
      'handmade',
      'florist',
      'flowers',
      'brewery',
      'bar',
      'bistro',
      'market',
      'catering',
      'ceramics',
      'local business',
    ],
    fonts: {
      display: 'Fraunces',
      body: 'Work Sans',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap',
    },
    colors: {
      background: '#F5EBD7',
      surface: '#FFF9ED',
      text: '#26382C',
      muted: '#756D5D',
      accent: '#D8643F',
      secondary: '#E8B83E',
    },
    aesthetic:
      'Human, sensory, and hand-finished. Mix confident editorial typography with organic edges and small crafted details.',
    layout:
      'Use a welcoming split hero, menu or offering bands, overlapping photography, handbill-style labels, and generous story sections.',
    components:
      'Open-hours badge, menu highlights, story card, location block, reservation CTA, ingredient notes, and tasteful stamp-like accents.',
    motion:
      'Gentle image drift, small rotations on hover, and soft reveal transitions that retain a handmade feeling.',
    imagery:
      'Choose close, warm photographs of food, hands, ingredients, rooms, and imperfect natural textures.',
    avoid:
      'Sterile tech grids, cold blue palettes, corporate iconography, perfect symmetry throughout, and generic stock imagery.',
  },
  {
    id: 'cinematic-studio',
    name: 'Cinematic Studio',
    summary:
      'A high-impact dark canvas with kinetic typography, vivid coral, and portfolio-first storytelling.',
    idealFor:
      'Creative agencies, design studios, artists, musicians, film, production, events, and culture brands.',
    keywords: [
      'creative agency',
      'design studio',
      'agency',
      'artist',
      'music',
      'musician',
      'band',
      'film',
      'filmmaker',
      'production',
      'festival',
      'event',
      'nightlife',
      'concert',
      'director',
      'creative',
      'branding',
      'culture',
    ],
    fonts: {
      display: 'Syne',
      body: 'Manrope',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Syne:wght@500;600;700;800&display=swap',
    },
    colors: {
      background: '#0C0B0D',
      surface: '#19171B',
      text: '#F5F0E9',
      muted: '#A49EA8',
      accent: '#FF704D',
      secondary: '#9B7BFF',
    },
    aesthetic:
      'Expressive, contemporary, and slightly confrontational. Let typography and project imagery behave like art direction.',
    layout:
      'Use a viewport-filling hero, oversized type, horizontal project strips, staggered case studies, and bold section transitions.',
    components:
      'Project reels, oversized numerals, marquee labels, image masks, compact credits, award rows, and magnetic-feeling CTAs.',
    motion:
      'Kinetic type, masked reveals, cursor-aware hover states, and controlled parallax; always respect prefers-reduced-motion.',
    imagery:
      'Use dramatic editorial crops, saturated project stills, and layered visual fragments with strong contrast.',
    avoid:
      'Conventional corporate sections, tiny timid headlines, stock business photos, pastel gradients, and uniform card grids.',
  },
  {
    id: 'playful-commerce',
    name: 'Playful Commerce',
    summary:
      'Bold retail energy with joyful color blocking, chunky typography, and highly shoppable storytelling.',
    idealFor:
      'E-commerce, consumer products, toys, kids, streetwear, pets, and energetic direct-to-consumer brands.',
    keywords: [
      'ecommerce',
      'e-commerce',
      'shop',
      'store',
      'retail',
      'product',
      'toy',
      'kids',
      'children',
      'streetwear',
      'pet',
      'pets',
      'snack',
      'candy',
      'merch',
      'merchandise',
      'consumer brand',
      'direct to consumer',
      'd2c',
    ],
    fonts: {
      display: 'Bricolage Grotesque',
      body: 'DM Sans',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,500..800&family=DM+Sans:wght@400;500;600;700&display=swap',
    },
    colors: {
      background: '#FFF4B8',
      surface: '#FFFDF4',
      text: '#171717',
      muted: '#64605A',
      accent: '#FF4F3D',
      secondary: '#315DFF',
    },
    aesthetic:
      'Optimistic, graphic, and punchy without becoming childish. Use color as structure and product benefits as visual moments.',
    layout:
      'Use a bold centered hero, color-blocked product bands, playful staggered cards, social proof, and a direct purchase path.',
    components:
      'Product tiles, flavor or variant chips, sticker-like callouts, review snippets, benefit marquees, bundles, and large add-to-cart CTAs.',
    motion:
      'Springy micro-interactions, subtle card tilts, ticker motion, and lively but short transitions.',
    imagery:
      'Feature crisp cutout products, joyful lifestyle photography, strong solid backdrops, and playful scale shifts.',
    avoid:
      'Muted corporate sameness, thin low-contrast type, tiny CTAs, endless white space, and overly serious stock photos.',
  },
  {
    id: 'calm-wellness',
    name: 'Calm Wellness',
    summary:
      'Soft confidence through botanical neutrals, graceful serif type, and generous breathing room.',
    idealFor:
      'Wellness, yoga, spas, beauty, skincare, therapy, retreats, nutrition, and mindful health brands.',
    keywords: [
      'wellness',
      'yoga',
      'spa',
      'beauty',
      'skincare',
      'skin care',
      'therapist',
      'therapy',
      'meditation',
      'retreat',
      'nutrition',
      'pilates',
      'massage',
      'salon',
      'mindfulness',
      'holistic',
      'self care',
      'self-care',
    ],
    fonts: {
      display: 'Cormorant Garamond',
      body: 'Plus Jakarta Sans',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap',
    },
    colors: {
      background: '#EEEADF',
      surface: '#F9F6EF',
      text: '#27342D',
      muted: '#73796F',
      accent: '#8EA184',
      secondary: '#6D466B',
    },
    aesthetic:
      'Restorative, refined, and credible. Use softness through proportion and color rather than decorative clutter.',
    layout:
      'Use an airy hero, curved image frames, alternating treatment stories, calm benefit rows, practitioner proof, and a gentle booking section.',
    components:
      'Service cards, ritual steps, practitioner note, ingredient callouts, testimonial quote, availability strip, and rounded but restrained CTAs.',
    motion:
      'Slow fades, gentle vertical reveals, and barely perceptible image movement. Respect calm over spectacle.',
    imagery:
      'Favor natural light, botanical texture, honest skin, quiet interiors, and close tactile details.',
    avoid:
      'Clinical coldness, loud neon, exaggerated wellness clichés, script-font overload, and vague low-contrast copy.',
  },
  {
    id: 'trusted-service',
    name: 'Trusted Service',
    summary:
      'Conversion-led clarity with authoritative typography, reassuring navy, and warm human proof.',
    idealFor:
      'Legal, finance, healthcare, consulting, insurance, home services, and other trust-sensitive businesses.',
    keywords: [
      'lawyer',
      'legal',
      'law firm',
      'accountant',
      'accounting',
      'financial advisor',
      'finance',
      'insurance',
      'dentist',
      'dental',
      'clinic',
      'doctor',
      'medical',
      'contractor',
      'plumbing',
      'electrician',
      'roofing',
      'consulting',
      'consultant',
      'professional services',
      'home services',
      'b2b service',
    ],
    fonts: {
      display: 'Sora',
      body: 'Source Sans 3',
      googleFontsUrl:
        'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap',
    },
    colors: {
      background: '#EDF2F2',
      surface: '#FFFFFF',
      text: '#102B32',
      muted: '#64777B',
      accent: '#087F73',
      secondary: '#D5A643',
    },
    aesthetic:
      'Assured, transparent, and human. Communicate competence immediately without looking institutional or generic.',
    layout:
      'Use a benefit-led hero, trust bar, clear service pathways, outcomes or metrics, a process section, and a prominent contact conversion block.',
    components:
      'Credential chips, service cards, review proof, response-time callout, simple process steps, FAQ, phone or booking CTA, and location details.',
    motion:
      'Functional hover feedback, subtle section reveals, and restrained metric emphasis. Reliability should lead the experience.',
    imagery:
      'Use authentic team, client, workplace, or neighborhood photography with warm natural light and confident crops.',
    avoid:
      'Handshake stock photos, shield icon clichés, walls of text, dark fear-driven visuals, and overpromising claims.',
  },
] as const;

const fallbackTemplateIds = [
  'editorial-luxury',
  'quiet-architecture',
  'modern-saas',
  'warm-craft',
  'cinematic-studio',
  'playful-commerce',
  'calm-wellness',
  'trusted-service',
] as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getDesignTemplate(id: string | null | undefined) {
  return designTemplates.find((template) => template.id === id);
}

export function extractTemplateId(html: string | undefined) {
  if (!html) return undefined;
  const match = html.match(
    /<meta\s+name=["']sleeksite-template["']\s+content=["']([^"']+)["'][^>]*>/i,
  );
  return getDesignTemplate(match?.[1])?.id;
}

function requestsNewVisualDirection(prompt: string) {
  return /\b(?:change|switch|replace|try|use|give|make|redesign|restyle)\b.{0,40}\b(?:style|aesthetic|template|look|visual direction|art direction)\b/i.test(
    prompt,
  );
}

export function selectDesignTemplate(
  prompt: string,
  previousHtml?: string,
  preferredTemplateId?: string,
) {
  const existingTemplate =
    getDesignTemplate(extractTemplateId(previousHtml)) ??
    (previousHtml ? getDesignTemplate(preferredTemplateId) : undefined);
  if (existingTemplate && !requestsNewVisualDirection(prompt))
    return existingTemplate;

  const normalizedPrompt = ` ${normalize(prompt)} `;
  let bestTemplate: DesignTemplate | undefined;
  let bestScore = 0;

  for (const template of designTemplates) {
    let score = 0;
    for (const keyword of template.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (normalizedPrompt.includes(` ${normalizedKeyword} `)) {
        score += normalizedKeyword.includes(' ') ? 7 : 3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  if (bestTemplate) return bestTemplate;

  const fallbackId =
    fallbackTemplateIds[
      stableHash(normalizedPrompt) % fallbackTemplateIds.length
    ];
  return getDesignTemplate(fallbackId) ?? designTemplates[0];
}

export function formatTemplatePrompt(template: DesignTemplate) {
  const palette = Object.entries(template.colors)
    .map(([role, value]) => `${role} ${value}`)
    .join(', ');

  return `
SELECTED DESIGN SYSTEM — ${template.name}
This is an art direction, not a canned page. Tailor its structure and content to the user's actual business while keeping the visual system coherent.
- Best fit: ${template.idealFor}
- Visual character: ${template.aesthetic}
- Typography: ${template.fonts.display} for expressive display moments; ${template.fonts.body} for UI and body copy. Load exactly: ${template.fonts.googleFontsUrl}
- Palette: ${palette}. Use the accent sparingly and maintain WCAG-readable contrast.
- Composition: ${template.layout}
- Component language: ${template.components}
- Motion: ${template.motion}
- Image direction: ${template.imagery}
- Avoid: ${template.avoid}
- Add this exact marker inside <head> so future edits retain the art direction: <meta name="sleeksite-template" content="${template.id}">
`;
}
