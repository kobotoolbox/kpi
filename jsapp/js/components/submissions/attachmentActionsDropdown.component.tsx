// Libraries:
import React, {useState} from 'react';
// Components:
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import KoboDropdown from 'js/components/common/koboDropdown';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import bem from 'js/bem';
// Helpers:
import * as utils from 'js/utils';
import {userCan} from 'js/components/permissions/utils';
// Types:
import type {
  AssetResponse,
  SubmissionAttachment,
} from 'js/dataInterface';

interface AttachmentActionsDropdownProps {
  asset: AssetResponse;
  attachment: SubmissionAttachment;
}

/**
 * Displays a "…" button that opens a dropdown with some actions available for
 * provided attachment. Delete option would display a safety check modal.
 */
export default function AttachmentActionsDropdown(
  props: AttachmentActionsDropdownProps
) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletePending, setIsDeletePending] = useState<boolean>(false);

  const toggleDeleteModal = () => {
    setIsDeleteModalOpen(!isDeleteModalOpen);
  };

  function confirmDelete() {
    console.log('confirmDelete');

    setIsDeletePending(true);

    setTimeout(() => {
      setIsDeletePending(false);
      toggleDeleteModal();
      utils.notify(t('##Attachment_type## deleted').replace('##Attachment_type##', t('Image')));
    }, 2000);
  }

  function requestDownloadFile() {
    console.log('requestDownloadFile', props.attachment);
    utils.downloadUrl(props.attachment.download_url);
  }

  const userCanDelete = userCan('delete_submissions', props.asset);

  const uniqueDropdownName = `attachment-actions-${utils.generateUuid()}`;

  return (
    <>
      <KoboDropdown
        name={uniqueDropdownName}
        placement='down-right'
        hideOnMenuClick
        triggerContent={
          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='more'
          />
        }
        menuContent={
          <bem.KoboSelect__menu>
            <bem.KoboSelect__option onClick={requestDownloadFile}>
              <Icon name='download' />
              <label>{t('Download')}</label>
            </bem.KoboSelect__option>

            <bem.KoboSelect__option onClick={toggleDeleteModal}>
              <Icon name='trash' />
              <label>{t('Delete')}</label>
            </bem.KoboSelect__option>
          </bem.KoboSelect__menu>
        }
      />

      <KoboModal
        isOpen={isDeleteModalOpen}
        onRequestClose={toggleDeleteModal}
        size='medium'
      >
        <KoboModalHeader onRequestCloseByX={toggleDeleteModal}>
          {t('Delete ##attachment_type##').replace('##attachment_type##', t('image'))}
        </KoboModalHeader>

        <KoboModalContent>
          <p>{t('Are you sure you want to delete this ##attachment_type##?').replace('##attachment_type##', t('image'))}</p>
        </KoboModalContent>

        <KoboModalFooter>
          <Button
            type='frame'
            color='dark-blue'
            size='l'
            onClick={toggleDeleteModal}
            label={t('Cancel')}
          />

          <Button
            type='full'
            color='dark-red'
            size='l'
            onClick={confirmDelete}
            label={t('Delete')}
            isDisabled={!userCanDelete}
            isPending={isDeletePending}
          />
        </KoboModalFooter>
      </KoboModal>
    </>
  );
}
