import React from 'react';
import bem, {makeBem} from 'js/bem';

bem.KoboModal__footer = makeBem(bem.KoboModal, 'footer', 'footer');

interface KoboModalFooterProps {
  children: React.ReactNode;
}

export default function KoboModalFooter(props: KoboModalFooterProps) {
  return (
    <bem.KoboModal__footer>
      {props.children}
    </bem.KoboModal__footer>
  );
}
