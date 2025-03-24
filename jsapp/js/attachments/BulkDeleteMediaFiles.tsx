import { FocusTrap, Button, Box, Checkbox, Text, Stack, Group} from "@mantine/core";
import { Modal } from '@mantine/core';
import { useFeatureFlag, FeatureFlag } from '#/featureFlags'
import { useDisclosure } from '@mantine/hooks';
import InlineMessage from '#/components/common/inlineMessage';

const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

export default function BulkDeleteMediaFiles() {
  const [opened, { open, close }] = useDisclosure(false);

  if (!isFeatureEnabled) {
    return null;
  }

  return (
    <Box>
      <Button onClick={open} size="s" variant="transparent">
        {t("Delete only media files")}
      </Button>


      <Modal opened={opened} onClose={close} title={t("Delete media files")} size={'md'}>
        <FocusTrap.InitialFocus />
        <Stack>
          <Checkbox
            label={
              <Text>
                {t(
                  "You are about to permanently remove the following media files from the selected submissions: "
                )}
                <br />
                {/*TODO: find a way to grab the attachment info and display it here*/}
                {t("2 videos, 1 image, 1 audio.")}
              </Text>
            }
          />
          <InlineMessage
            icon="warning"
            type="warning"
            message={t(
              "Careful - it is not possible to recover deleted media files"
            )}
          />

          <Group justify="flex-end">
            <Button variant="light" size="lg" onClick={close}>
              {t("Cancel")}
            </Button>

            <Button variant="danger" size="lg">
              {/*TODO: Mock the bulk deleting here and see if handling it like the individual removal is possible (use the "is_deleted" mocking, see markAttachmentAsDeleted. This probably is not going to be easy without access to the submissions themselves*/}
              {t("Delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
