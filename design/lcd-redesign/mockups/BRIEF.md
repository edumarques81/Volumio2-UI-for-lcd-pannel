# Mockup Build Brief — For All Agents

## Target
Build a self-contained HTML file at exactly **1920×440 pixels**. Each file must work standalone with embedded CSS and JS. No external dependencies except Google Fonts (Roboto, Plus Jakarta Sans).

## Display: 1920×440 Ultrawide Bar LCD
- Dark theme ONLY (this is an audio room display)
- Touch-optimized: minimum 44×44px touch targets
- MD3 design tokens where applicable

## MD3 Colour Tokens (dark theme, rose seed)
```css
--md-primary: #FFB1C8;
--md-on-primary: #5D1133;
--md-primary-container: #7B2949;
--md-on-primary-container: #FFD9E3;
--md-secondary: #E3BDC6;
--md-on-secondary: #422931;
--md-surface: #1A1114;
--md-surface-container: #261A1E;
--md-surface-container-high: #312228;
--md-surface-container-low: #201318;
--md-on-surface: #F0DEE2;
--md-on-surface-variant: #D5BFC4;
--md-outline: #9E8C91;
--md-outline-variant: #514347;
--md-background: #1A1114;
--md-error: #FFB4AB;
```

## MD3 Typography
```css
--md-display-large: 57px;
--md-headline-large: 32px;
--md-title-large: 22px;
--md-title-medium: 16px;
--md-body-large: 16px;
--md-body-medium: 14px;
--md-label-large: 14px;
--md-label-medium: 12px;
```

## MD3 Shape
```css
--md-shape-none: 0px;
--md-shape-extra-small: 4px;
--md-shape-small: 8px;
--md-shape-medium: 12px;
--md-shape-large: 16px;
--md-shape-extra-large: 28px;
--md-shape-full: 9999px;
```

## Mock Data for "Now Playing"
- **Track:** "Time" 
- **Artist:** Pink Floyd
- **Album:** The Dark Side of the Moon
- **Duration:** 7:04
- **Current position:** 2:34
- **Format:** FLAC · 96kHz · 24bit
- **Source:** NAS
- **Album art:** Use a CSS gradient placeholder (dark blue → purple → black prism triangle)

## Queue (mock)
1. "The Great Gig in the Sky" — Pink Floyd (5:43)
2. "Money" — Pink Floyd (6:22)  
3. "Us and Them" — Pink Floyd (7:49)
4. "Any Colour You Like" — Pink Floyd (3:25)
5. "Brain Damage" — Pink Floyd (3:50)

## Library Albums (mock, for browse views)
Use 8-12 placeholder album tiles with CSS gradient backgrounds and fake names.

## Requirements per mockup
1. Show "Now Playing" state as the default view
2. At least one interactive navigation demo (click/tap to transition)
3. Hover/active states on all interactive elements
4. Smooth CSS transitions (200-400ms, ease-out)
5. Progress bar should be interactive (click to seek — simulated)
6. Volume indicator somewhere
7. Format/quality badges visible
8. The HTML body must be exactly 1920×440 with `overflow: hidden`

## File naming
- approach-a.html (Vinyl Groove)
- approach-b.html (Command Deck)
- approach-c.html (Cinematic Strip)  
- approach-d.html (The Jukebox)
- approach-e.html (Spectrum)

## Output location
`/Users/eduardomarques/workspace/Volumio2-UI/design/lcd-redesign/mockups/`
