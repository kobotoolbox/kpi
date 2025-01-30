import Button from '../common/button';
import KoboPrompt from '../modals/koboPrompt';
import {useState} from 'react';
import {handleApiFail} from 'jsapp/js/api';
import type {FailResponse} from 'jsapp/js/dataInterface';

const MessageModal = ({onClose}: {onClose: () => void}) => (
  <KoboPrompt
    isOpen
    onRequestClose={onClose}
    title={t('Exporting data')}
    buttons={[
      {
        label: 'Ok',
        onClick: onClose,
      },
    ]}
  >
    {t(
      "Your export request is currently being processed. Once the export is complete, you'll receive an email with all the details."
    )}
  </KoboPrompt>
);

/**
 * Button to be used in views that export data to email.
 * The button receives a label and an export function that should return a promise.
 * The function is called when the button is clicked and if no error occurs, a message is shown to the user.
 */
export default function ExportToEmailButton({
  exportFunction,
  label,
}: {
  exportFunction: () => Promise<unknown>;
  label: string;
}) {
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleClick = () => {
    setIsPending(true);
    exportFunction()
      .then(() => {
        setIsMessageOpen(true);
      })
      .catch((error) => handleApiFail(error as FailResponse))
      .finally(() => {
        setIsPending(false);
      });
  };

  return (
    <>
      <Button
        size='m'
        type='primary'
        label={label}
        startIcon='download'
        onClick={handleClick}
        isPending={isPending}
      />
      {isMessageOpen && (
        <MessageModal onClose={() => setIsMessageOpen(false)} />
      )}
    </>
  );
}
