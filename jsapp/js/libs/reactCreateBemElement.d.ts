interface BemComponent extends React.ComponentClass {
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