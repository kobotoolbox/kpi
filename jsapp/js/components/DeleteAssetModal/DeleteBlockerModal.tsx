import { Anchor, Group, List, ScrollArea, Stack, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'

export enum DeleteBlockerReason {
  submissions = 'submissions',
  permissions = 'permissions',
}

export interface DeleteBlockerModalProps {
  assets: Array<AssetResponse | ProjectViewAsset>
  reason: DeleteBlockerReason
  onRequestClose: () => void
}

export function DeleteBlockerModal({ assets, reason, onRequestClose }: DeleteBlockerModalProps) {
  const isSingle = assets.length === 1
  const assetsWithSubmissions = assets.filter((asset) => (asset.deployment__submission_count ?? 0) > 0)

  let body: string
  let alertText: string

  switch (reason) {
    case DeleteBlockerReason.submissions:
      if (isSingle) {
        body = t('In order to delete this project, all submissions need to be deleted first')
        alertText = t(
          'Projects with data cannot be deleted as part of a team. Only empty projects with no submissions can be deleted.',
        )
      } else {
        body = t(
          "The following projects have submissions and can't be deleted until all submissions have been deleted:",
        )
        alertText = t(
          'Projects with data cannot be deleted as part of a team. Please make sure none of the projects selected contain any submissions.',
        )
      }
      break
    case DeleteBlockerReason.permissions:
      if (isSingle) {
        body = t('This project can only be deleted by its owner or a team administrator.')
        alertText = t('Only the project owner or a team administrator can delete this project.')
      } else {
        body = t('Some of the selected projects can only be deleted by their owner or a team administrator.')
        alertText = t('Only the project owners or a team administrator can delete these projects.')
      }
      break
  }

  const navigateToProject = (asset: AssetResponse | ProjectViewAsset) => {
    onRequestClose()
    router!.navigate(ROUTES.FORM_LANDING.replace(':uid', asset.uid))
  }

  return (
    <Stack gap='sm'>
      <Text size='sm'>{body}</Text>

      {reason === DeleteBlockerReason.submissions && !isSingle && assetsWithSubmissions.length > 0 && (
        <ScrollArea.Autosize mah={150} type='auto' offsetScrollbars>
          <List
            type='unordered'
            pl='md'
            aria-label={t('Projects with submissions that cannot be deleted')}
            icon={
              <Text span aria-hidden size='sm' c='blue.4'>
                •
              </Text>
            }
          >
            {assetsWithSubmissions.map((asset) => (
              <List.Item key={asset.uid}>
                <Anchor c='blue.4' td='underline' onClick={() => navigateToProject(asset)}>
                  {asset.name}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </ScrollArea.Autosize>
      )}

      <Alert m={0} type='info' iconName='information'>
        {alertText}
      </Alert>

      <Group justify='flex-end' mt='xs'>
        <ButtonNew variant='filled' size='md' onClick={onRequestClose}>
          {t('OK')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
