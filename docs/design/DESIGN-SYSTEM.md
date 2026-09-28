# Milspår — Design System v1.0

**Status: LOCKED**  
**Baseline:** 2026-09-28  
**Design direction:** Light Nordic Automotive  
**Accent:** Yellow

> Detta dokument är Milspårs visuella kontrakt. Implementation får inte lokalt byta färger, typografi, spacing, radius, navigationsmönster eller övergripande komponentstil. Sådana ändringar kräver ett uttryckligt designbeslut och ny version av denna specifikation.

## 1. Designmål

Milspår ska kännas modernt, lugnt, tekniskt och premium utan att efterlikna en specifik biltillverkares app. Fordonsbilder och användarens innehåll ska stå för mycket av färgen. UI:t ska vara informationsrikt utan att kännas som fleet-management eller verkstads-ERP.

Nyckelord: **ljust, luftigt, grafit, gul accent, automotive, fotografiskt, tydligt, responsivt**.

## 2. Visuell referens

Den godkända mockupen från projektets designfas är huvudreferens för känsla och komposition. Vid konflikt mellan fria designidéer och denna spec gäller denna spec. Mockupen ska senare checkas in under `docs/design/mockups/` när binär filpublicering ingår i arbetsflödet.

## 3. Färgtokens

Följande är baseline tokens. Mindre kontrastjusteringar för WCAG får göras utan att ändra designriktningen, men accentens karaktär ska bevaras.

```css
:root {
  --color-bg: #F7F7F5;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F1F1EE;
  --color-text: #171717;
  --color-text-muted: #6B6B67;
  --color-border: #E3E3DE;

  --color-accent: #F5C518;
  --color-accent-hover: #E5B600;
  --color-accent-soft: #FFF7D1;
  --color-on-accent: #171717;

  --color-success: #2E7D4F;
  --color-success-soft: #EAF5EE;
  --color-warning: #A86E00;
  --color-warning-soft: #FFF3D6;
  --color-danger: #B54242;
  --color-danger-soft: #FBEAEA;
  --color-info: #376A8A;
  --color-info-soft: #EAF2F7;
}
```

**Regel:** Accentgult betyder primär handling/aktivt val, inte automatiskt varning. Warning måste ha separat semantik.

## 4. Typografi

Primär fontstack:

```css
font-family: Inter, Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Rekommenderad skala:

- Display: 32/40, 700
- H1: 28/36, 700
- H2: 22/30, 650–700
- H3: 18/26, 600
- Body: 16/24, 400
- Small: 14/20, 400–500
- Caption: 12/16, 500
- KPI value: 28–36, 650–700

Undvik överdriven uppercase. Registreringsnummer, korta labels och tekniska metadata kan använda uppercase sparsamt.

## 5. Spacing

Basenhet: **4 px**.

```text
1 = 4px
2 = 8px
3 = 12px
4 = 16px
5 = 20px
6 = 24px
8 = 32px
10 = 40px
12 = 48px
16 = 64px
```

Normal kort-padding: 20–24 px desktop, 16–20 px mobile.

## 6. Radius

- Small controls/badges: 8 px
- Inputs/buttons: 10 px
- Cards: 14 px
- Large image/hero cards: 16 px
- Pills: full radius

Undvik extremt bubblig UI-design.

## 7. Borders och shadows

Kort ska i första hand separeras med yta + tunn border. Shadows ska vara subtila.

```css
--shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.04);
```

Hover får öka elevation försiktigt. Undvik starka drop shadows.

## 8. Knappar

### Primary
Gul bakgrund, mörk text, medium/semibold. Använd för huvudhandling såsom `+ Lägg till`, `Spara`, `Godkänn import`.

### Secondary
Vit/surface, mörk text, border.

### Tertiary
Text/icon utan card-liknande bakgrund.

### Destructive
Danger-semantic, aldrig accentgul.

Minsta touchyta: **44×44 px**.

## 9. Ikoner

Använd en konsekvent outline-ikonfamilj, exempelvis Lucide. Normal stroke, inga blandade ikonstilar. Emoji ska inte användas som produktionsikoner.

## 10. Cards

Kort är grundkomponenten för fordonskort, KPI, upcoming actions, kostnader och dokument. Ett kort ska ha ett tydligt informationssyfte och normalt högst en primär handling.

Fordonskort får vara mer visuella och använda stor coverbild.

## 11. Fordonsbilder

Profilbilden är central men får inte dominera så mycket att data hamnar under fold på normala skärmar. Använd bred beskärning och `object-fit: cover`. Originalet ska aldrig beskäras destruktivt.

## 12. Status

Status får aldrig kommuniceras enbart med färg. Kombinera färg med text och vid behov ikon.

- Success: OK/klart
- Warning: snart/uppmärksamhet
- Danger: förfallen/problem
- Info: neutral information

## 13. Grafer

Grafer ska vara få och beslutstödjande. Gul accent kan användas för primär dataserie. Sekundära serier ska använda neutrala/semantiska toner. Grafer måste fungera även utan färg genom labels/legends.

## 14. Tabeller

Desktop får använda datatabeller. Mobil ska i första hand omforma tabellrader till cards/list rows i stället för horisontell scroll, utom när jämförelsens natur kräver tabell.

## 15. Formulär

Labels ska alltid vara synliga; placeholder ersätter inte label. Fält grupperas efter användarens arbetsflöde. Vanliga registreringar ska kunna slutföras med få fält och avancerade fält får ligga under `Mer information`.

## 16. Dark mode

Dark mode är planerad men inte del av den låsta v1-implementationen. Light mode är den visuella källan. Dark mode ska senare härledas semantiskt från samma tokens, inte designas som en separat produkt.

## 17. Do

- Ge innehåll och fotografier luft
- Prioritera tydlig hierarki
- Använd gul accent sparsamt och konsekvent
- Behåll navigation och actions på förutsägbara platser
- Anpassa arbetsflödet per viewport, inte bara storleken

## 18. Don't

- Byt inte accentfärg per vy
- Skapa inte gradienttungt eller neonbetonat UI
- Använd inte glassmorphism som grundstil
- Gör inte alla kort klickbara om de inte leder någonstans
- Lägg inte grafer på dashboarden enbart som dekoration
- Gör inte desktop-sidebar till en hoptryckt mobil-sidebar
- Introducera inte nya radius/shadow/färgskalor lokalt

## 19. Versionsregel

- `1.0.x`: dokumentationsförtydliganden utan visuell förändring
- `1.x`: kompatibla komponent-/tokenutökningar
- `2.0`: avsiktlig förändring av den visuella identiteten

Designändringar ska dokumenteras med motivation och exempel innan implementation.
