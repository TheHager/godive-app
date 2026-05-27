---
name: Luminous Minimalist
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e484f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7880'
  outline-variant: '#bdc8d0'
  surface-tint: '#006689'
  primary: '#006386'
  on-primary: '#ffffff'
  primary-container: '#007da8'
  on-primary-container: '#fbfcff'
  inverse-primary: '#78d1ff'
  secondary: '#5d5e61'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e5'
  on-secondary-container: '#636467'
  tertiary: '#595c5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#727577'
  on-tertiary-container: '#fbfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c3e8ff'
  primary-fixed-dim: '#78d1ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c68'
  secondary-fixed: '#e2e2e5'
  secondary-fixed-dim: '#c6c6c9'
  on-secondary-fixed: '#1a1c1e'
  on-secondary-fixed-variant: '#454749'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1280px
---

## Brand & Style
The design system embodies a "Luminous Minimalist" aesthetic, pivoting from deep shadows to an airy, high-clarity environment. It draws inspiration from the precision and legibility of high-end maritime chronometers and professional dive watches. 

The emotional response should be one of crystalline focus and premium reliability. By utilizing expansive whitespace (white-on-white layering) and surgical precision in line-work, the UI feels both athletic and sophisticated. The style is **Minimalist with a High-Contrast edge**, favoring structural clarity over decorative elements. It avoids heavy containers in favor of thin, technical borders and subtle ambient depth, ensuring the interface feels light yet grounded.

## Colors
The palette is anchored by a sterile **Crisp White (#FFFFFF)** background to maximize "breathability." 

- **Primary (Aquatic Blue):** Adjusted to #0099CC to maintain a vibrant, "bio-luminescent" feel while ensuring AA contrast ratios against white surfaces. This is used for interactive states, key indicators, and data highlights.
- **Secondary (Charcoal Navy):** A high-contrast dark navy (#1A1C1E) used for primary text and iconography to ensure maximum legibility, mimicking the ink-black hands of a premium watch.
- **Surface & Stroke:** We use a hierarchy of cool grays (#F1F5F9 to #E2E8F0) for subtle borders and secondary backgrounds, maintaining the "Luminous" feel without introducing heavy visual weight.

## Typography
**Manrope** is used exclusively to maintain a modern, technical, and highly legible appearance. 

The typographic hierarchy relies on significant weight contrast. Display and Headline styles use **ExtraBold (800)** or **Bold (700)** with tight letter-spacing to create a sense of structural "impact." Labels use all-caps with increased tracking to mimic the engraved markings found on professional instruments. Body text remains clean and open for effortless reading during high-activity use.

## Layout & Spacing
The layout follows a **Strict 8px Grid** system to ensure mathematical precision. 

A **12-column fluid grid** is used for desktop layouts, transitioning to a **4-column grid** for mobile. Negative space is treated as a functional element; margins are generous (#margin-desktop) to prevent the "cluttered" feel of traditional enterprise apps. Components are grouped using logical padding increments (16, 24, 40, 64) to create a clear visual rhythm.

## Elevation & Depth
Depth is communicated through **Optical Layering** rather than heavy shadows. 

1.  **Level 0 (Base):** Flat #FFFFFF background.
2.  **Level 1 (Subtle Lift):** Used for cards and primary containers. Defined by a 1px stroke in #E2E8F0 and an ultra-soft, diffused shadow (0px 4px 20px rgba(0,0,0,0.04)).
3.  **Level 2 (Floating):** Used for menus and modals. A slightly more pronounced shadow (0px 12px 40px rgba(0,0,0,0.08)) to indicate priority.

Avoid background blurs or frosted glass. Content should feel like it is sitting on a physical, solid white surface.

## Shapes
Following the "ROUND_EIGHT" philosophy, this design system uses a medium-radius approach to balance approachability with professional geometry. 

- **Standard UI Elements:** 0.5rem (8px) corner radius for buttons, inputs, and small widgets.
- **Large Containers:** 1rem (16px) for cards and sections to soften the large white expanses.
- **Interactive Accents:** Small circular elements (pill-shaped) are reserved for status indicators and specific "action" chips to differentiate them from structural components.

## Components
- **Buttons:** Primary buttons use a solid #0099CC fill with white text. Secondary buttons use a 1px #E2E8F0 border with #1A1C1E text. All buttons feature high horizontal padding (24px) for a premium feel.
- **Inputs:** Minimalist 1px bottom-border or full-border in #E2E8F0. Focus state transitions the border to #0099CC with a subtle glow.
- **Cards:** White background, 1px #F1F5F9 border, and the "Level 1" elevation shadow. Internal padding should be a minimum of 24px.
- **Chips/Badges:** Use a soft #F1F5F9 background with high-contrast #64748B text for a technical, utility look.
- **Data Visualization:** Use the primary Aquatic Blue as the lead color, supported by thin lines and "Watch-face" style ticks for axis markings.
- **Lists:** Separated by 1px hairlines (#F1F5F9) rather than alternating row colors, maintaining the ultra-clean light mode aesthetic.