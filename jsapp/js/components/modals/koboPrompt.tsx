import React from 'react';
import type {IconName} from 'jsapp/fonts/k-icons';
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
  shouldCloseOnOverlayClick?: boolean;
  /** NOTE: disabling Esc key may introduce an accessibility issue. */
  shouldCloseOnEsc?: boolean;
  title: string;
  /** Optional icon displayed on the left of the title. */
  titleIcon?: IconName;
  /** Color of the optional icon. */
  titleIconColor?: 'blue' | 'red';
  /** The content of the propmt; pass a string or a more complex JSX. */
  children?: React.ReactNode;
  /** A list of buttons to be displayed on the bottom right of the prompt. */
  buttons: KoboPromptButton[];
  /** Renders a `data-testid` attribute in the DOM. */
  testId?: string;
}

export default function KoboPrompt(props: KoboPromptProps) {
  return (
    <KoboModal
      isOpen={props.isOpen}
      onRequestClose={props.onRequestClose}
      shouldCloseOnOverlayClick={props.shouldCloseOnOverlayClick}
      shouldCloseOnEsc={props.shouldCloseOnEsc}
      testId={props.testId}
    >
      <KoboModalHeader
        icon={props.titleIcon}
        iconColor={props.titleIconColor}
      >
        {props.title}
      </KoboModalHeader>

      <KoboModalContent>
        {props.children}
      </KoboModalContent>

      <KoboModalFooter>
        {props.buttons.map((promptButton, index) =>
          <Button
            key={index}
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
