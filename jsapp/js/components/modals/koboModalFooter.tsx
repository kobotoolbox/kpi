import React from 'react';
import bem, {makeBem} from 'js/bem';

bem.KoboModal__footer = makeBem(bem.KoboModal, 'footer', 'footer');

export type KoboModalFooterAlignment = 'end' | 'center';

interface KoboModalFooterProps {
  children: React.ReactNode;
  alignment?: KoboModalFooterAlignment;
}

export default function KoboModalFooter(props: KoboModalFooterProps) {
  return (
    <bem.KoboModal__footer m={props.alignment || 'end'}>
      {props.children}
    </bem.KoboModal__footer>
  );
}
