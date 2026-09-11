---
name: Luminous Logistics
colors:
  surface: '#f9f9f9'
  surface-dim: '#d7dbdb'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f4'
  surface-container: '#eceeee'
  surface-container-high: '#e6e8e9'
  surface-container-highest: '#e0e3e4'
  on-surface: '#2f3334'
  on-surface-variant: '#5c6060'
  inverse-surface: '#0c0f0f'
  inverse-on-surface: '#9c9d9d'
  outline: '#777b7c'
  outline-variant: '#afb3b3'
  surface-tint: '#566600'
  primary: '#566600'
  on-primary: '#f4ffbe'
  primary-container: '#d3ef58'
  on-primary-container: '#4a5800'
  inverse-primary: '#e2fe65'
  secondary: '#00687b'
  on-secondary: '#effbff'
  secondary-container: '#adecff'
  on-secondary-container: '#005a6a'
  tertiary: '#2c6295'
  on-tertiary: '#f7f9ff'
  tertiary-container: '#8ebff9'
  on-tertiary-container: '#003b65'
  error: '#a83836'
  on-error: '#fff7f6'
  error-container: '#fa746f'
  on-error-container: '#6e0a12'
  primary-fixed: '#d3ef58'
  primary-fixed-dim: '#c6e04b'
  on-primary-fixed: '#394400'
  on-primary-fixed-variant: '#536200'
  secondary-fixed: '#adecff'
  secondary-fixed-dim: '#76e3ff'
  on-secondary-fixed: '#004653'
  on-secondary-fixed-variant: '#006577'
  tertiary-fixed: '#8ebff9'
  tertiary-fixed-dim: '#80b2ea'
  on-tertiary-fixed: '#002442'
  on-tertiary-fixed-variant: '#004473'
  primary-dim: '#4b5900'
  secondary-dim: '#005b6c'
  tertiary-dim: '#1c5689'
  error-dim: '#67040d'
  background: '#f9f9f9'
  on-background: '#2f3334'
  surface-variant: '#e0e3e4'
typography:
  display-lg:
    fontFamily: Anybody
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-xl:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Anybody
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.3'
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.5'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  page-margin: 2rem
  gutter: 1.5rem
  card-padding: 1.25rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style

This design system embodies the concept of "High-Visibility Efficiency." It is a vibrant, modern professional environment designed for the "Rothirsch Umzüge" ecosystem. The aesthetic has evolved toward a more grounded yet still high-energy palette that suggests speed, energy, and digital-first logistics.

The style is a sophisticated blend of **Tonal-Spot Modernism** and **Dynamic Professionalism**. It prioritizes clarity and high-activity readability, utilizing neutral grey surfaces and focused color highlights. The emotional response is one of organization, reliability, and expert digital service.

**Design Principles:**
- **Clarity & Energy:** Use of high-visibility accents (Moss Lime) to drive attention to critical actions without sacrificing professional weight.
- **Structural Integrity:** Reliance on industrial neutral tones to ground the vibrant accent colors.
- **Digital Velocity:** Elements should feel like high-performance tools in a fast-paced, modern workspace.

## Colors

The palette is anchored by a sophisticated **Moss Lime**, a color that signals action and visibility while maintaining a more professional, grounded presence than a pure electric neon.

The system utilizes a **Light Mode** foundation. The background uses a clean **Neutral Grey** base (#e8e8e8) to provide a more industrial and solid foundation. Secondary colors introduce a bright **Tech Cyan**, while the Tertiary deep blue is used for grounded contrast. The neutral palette is shifted toward a balanced industrial grey.

- **Primary:** Moss Lime (#9bb41f) for CTAs, critical progress, and branding.
- **Secondary:** Tech Cyan (#21b1ce) for supporting containers and secondary actions.
- **Surface:** Industrial Off-White/Grey for the base application canvas.
- **Neutral:** Technical Grey (#e8e8e8) for borders and background depth.

## Typography

This system employs a dual-font strategy to balance industrial personality with functional utility. We use **Anybody** for all headlines and display text, bringing a variable-width, expansive, and ultra-modern feel that resonates with movement and speed. For body text, labels, and UI controls, **Plus Jakarta Sans** is used to maintain precision and readability.

**Hierarchy Rules:**
- **Display & Headlines:** Set in **Anybody**. Use tighter tracking and bold weights to emphasize the "logistics" movement.
- **Body & Labels:** Set in **Plus Jakarta Sans**. Utilize "Label Caps" for table headers, small metadata, and category tags to create a structured "manifest" feel.
- **Data Points:** Numbers should always be rendered in semibold or bold weights of Plus Jakarta Sans to ensure legibility against neutral backgrounds.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid with Fluid Containers**. The application uses a 12-column grid system for desktop, transitioning to a single-column stack for mobile.

**Grid Parameters:**
- **Desktop:** 12-column grid, 1440px max-width, 24px gutters.
- **Tablet:** 8-column grid, 16px gutters.
- **Mobile:** 4-column grid, 16px margins.

Spacing follows a strict 4px/8px baseline. Use consistent "Stack" spacing to maintain a rhythmic, organized feel across all data-heavy views.

## Elevation & Depth

Depth is conveyed through **Tonal Layering and High-Contrast Outlines**. In this system, we avoid heavy shadows in favor of subtle neutral surface shifts and crisp borders.

**Layering Logic:**
1. **Level 0 (Base):** Solid neutral grey background (#e8e8e8).
2. **Level 1 (Sub-surface):** Inset containers using a slightly deeper neutral tone.
3. **Level 2 (Cards):** Pure white surfaces with a 1px neutral border (#d1d1d1).
4. **Level 3 (Interactive/Hover):** Add a primary lime (#9bb41f) accent or border weight to indicate focus.

**Shadows:** Shadows are used sparingly, primarily for floating elements like Modals, using a crisp grey shadow to maintain the clean, technical aesthetic.

## Shapes

The shape language is **"Pill-Shaped Sophistication."** Corner radii are generous and fluid, signaling a premium, modern software experience that feels approachable yet high-tech.

- **Primary Containers:** 2rem (`rounded-lg`) for cards, kanban columns, and modals.
- **Form Elements:** 1rem (`rounded-md`) for buttons and inputs.
- **Status Pills:** Fully rounded (`rounded-full`) to differentiate them from interactive elements.

## Components

### Technical Stat Cards
Large numerical displays on a Level 2 white surface. Backgrounds are clean, but feature a 4px left-edge accent in the primary **Moss Lime**. Cards use the signature `rounded-lg` (2rem) radius.

### Minimalist Kanban
Columns use a Level 1 inset neutral background. Cards within columns use Level 2 white surfaces with a 1px border. Use the primary lime color for active status indicators.

### Data Tables
Sticky headers must use a solid neutral-grey surface. Rows use a 1px bottom border using the `outline-variant` token.

### Interactive Buttons
- **Default:** Solid Moss Lime (#9bb41f) with dark neutral text. On hover, apply a slight brightness increase.
- **Secondary:** Solid Tech Cyan (#21b1ce) with white text.
- **Micro-interaction:** On click, apply a `scale(0.98)` transform for tactile feedback.

### Status Badges
High-contrast badges using a 12% opacity background of the accent color and 100% opacity text. Text must be `label-caps` typography.