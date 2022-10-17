import React from 'react';
import type {ReactElement} from 'react';
import type {IconNames} from 'jsapp/fonts/k-icons';
import type {
  ButtonType,
  ButtonColor,
} from 'jsapp/js/components/common/button';
import Button from 'jsapp/js/components/common/button';
import KoboModal from './koboModal';
import KoboModalHeader from './koboModalHeader';
import KoboModalContent from './koboModalContent';
import KoboModalFooter from './koboModalFooter';

interface KoboPromptButton {
  type?: ButtonType;
  color?: ButtonColor;
  label: string;
  onClick: () => void;
}

const defaultButtonType = 'full';
const defaultButtonColor = 'blue';

interface KoboPromptProps {
  /** For displaying the prompt. */
  isOpen: boolean;
  /**
   * Request from the inside for the prompt parent to close it. Note that prompt
   * doesn't have "x" close button, so make sure there is a way to close it :)
   */
  onRequestClose: () => void;
  title: string;
  /** Optional icon displayed on the left of the title. */
  titleIcon?: IconNames;
  /** Color of the optional icon. */
  titleIconColor?: 'blue' | 'red';
  /** The content of the propmt; pass a string or a more complex JSX. */
  content: ReactElement | string;
  /** A list of buttons to be displayed on the bottom right of the prompt. */
  buttons: KoboPromptButton[];
}

export default function KoboPrompt(props: KoboPromptProps) {
  return (
    <KoboModal
      isOpen={props.isOpen}
      onRequestClose={props.onRequestClose}
    >
      <KoboModalHeader
        icon={props.titleIcon}
        iconColor={props.titleIconColor}
      >
        {props.title}
      </KoboModalHeader>

      <KoboModalContent>
        {props.content}
      </KoboModalContent>

      <KoboModalFooter>
        {props.buttons.map((promptButton) =>
          <Button
            type={promptButton.type || defaultButtonType}
            color={promptButton.color || defaultButtonColor}
            size='m'
            label={promptButton.label}
            onClick={promptButton.onClick}
          />
        )}
      </KoboModalFooter>
    </KoboModal>
  );
}
