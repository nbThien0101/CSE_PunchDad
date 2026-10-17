import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';

export default function HitDadUIProvider({ children }) {
  return <OverlayProvider><div className="hitdad-app" data-ui="gluestack-core-v3">{children}</div></OverlayProvider>;
}
