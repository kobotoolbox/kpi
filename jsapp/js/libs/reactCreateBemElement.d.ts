interface BemComponentProps {
  m?: string|string[]
  modifier?: string|string[]
}

class BemComponent<P extends BemComponentProps> extends React.Component<P, void> {
  __: (className: string, elementType?: string) => BemComponent
}

export interface BemDefinition {
  [elementName: string]: BemComponent
  create: (className: string, elementType?: string) => BemComponent
}

export const BEM: {
  (className: string, elementType?: string): BemComponent
  init: () => BemDefinition
}