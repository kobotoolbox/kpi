import type {ButtonProps} from '../common/button';
import Button from '../common/button';
import KoboPrompt from '../modals/koboPrompt';
import {useState} from 'react';
import alertify from 'alertifyjs';

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
    <div>
      <p>
        {t(
          "Your export request is currently being processed. Once the export is complete, you'll receive an email with all the details."
        )}
      </p>
    </div>
  </KoboPrompt>
);

export default function ExportToEmailButton({
  exportFunction,
  ...props
}: Partial<ButtonProps> & {
  exportFunction: () => Promise<void>;
}) {
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleClick = () => {
    setIsPending(true);
    exportFunction()
      .then(() => {
        setIsMessageOpen(true);
      })
      .catch(() => {
        alertify.error(t('There was an error exporting the data'));
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  return (
    <>
      <Button
        size='m'
        type='primary'
        {...props}
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
