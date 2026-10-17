# HitDad UI

The web application uses the free **gluestack UI Core v3** component factories,
with a custom **HitDad Club** theme: CSE navy, gold highlights, white surfaces,
rounded cards and visible keyboard focus. No Pro template or paid assets are required.

## Integration

- `src/components/ui/index.jsx`: Button, Input, Textarea, Alert and Modal use actual
  gluestack Core factories. DOM adapters preserve form submission, native date/time
  inputs, file selection, label associations and existing React event handlers.
- Card, Badge and Box follow gluestack's locally owned component pattern. Select,
  checkbox, radio, range and file controls use native HTML behavior for the web.
- `Provider.jsx` uses gluestack's OverlayProvider. `theme.css` holds branding,
  responsive navigation, focus styles, safe areas and reduced-motion behavior.
- Vite aliases React Native to React Native Web and selects `.web` modules first.
- The gluestack hooks adapter re-exports only the two upstream hooks used by Modal.
  This excludes the upstream hooks barrel's Tailwind build-time resolver. Styling
  uses CSS tokens; the web client does not run NativeWind or Tailwind compilation.
- Modal content uses React Aria's dialog and FocusScope with a DOM ref. Core v3's
  default content calls `findNodeHandle`, unsupported in React Native Web 0.21.
- Core/utils and React Aria dependencies are pinned. `client/.npmrc` skips native
  peer packages: these web adapters do not require native React Native, SVG or
  safe-area packages. Recheck the hooks adapter and dialog when upgrading Core.

The DOM adapters are for this web client. A future Expo repository should provide
native components for the same design tokens and component contracts, rather than
copying the DOM adapters or this Vite configuration.

## Responsive behavior

Desktop uses the existing top navigation and multi-column content. At 768px and
below, mobile gets bottom navigation, single-column match cards, touch controls,
16px form text, safe-area padding and dialogs sized to the dynamic viewport.
Pages are loaded on demand to reduce initial downloading.

## Review locally

Run `npm run dev` in `client`, then open:

- `/tests/ui-responsive-preview.html`: real dashboard screens inside 390px and
  1280px frames using mock API data.
- `/tests/ui-preview.html?screen=login`: real login screen with a mock login API.
- `/tests/ui-controls.html`: forms and dialog interaction checks.

Fixtures intercept requests locally and must be opened on a separate development
port from any real login session; the application preview uses a demo localStorage
token. They are not included in the production build. After leaving the preview,
clear the demo token before opening the real app on that port.

Check label-based typing, date selection, form submission, disabled buttons, refs,
modal focus containment/restoration, Escape, vote and admin approval. Review long
Vietnamese content at small widths and ensure no horizontal page overflow.

`npm run build` produces the production web client. `npm audit` checks dependency
advisories. The one-time JSX migration script is idempotent; it preserves handlers
and formatting and is not needed when running the app.

## Branding and infrastructure

Visible branding, package names, email subjects/sender display names and docs use
HitDad. The existing Render endpoint/service identifier and SMTP email address
remain the actual configured infrastructure; changing them requires provisioning
the new endpoint/address rather than a text replacement.
