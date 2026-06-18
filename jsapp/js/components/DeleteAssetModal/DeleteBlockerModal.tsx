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
  blockedAssets?: Array<AssetResponse | ProjectViewAsset>
  reason: DeleteBlockerReason
  onRequestClose: () => void
}

export function DeleteBlockerModal({ assets, blockedAssets, reason, onRequestClose }: DeleteBlockerModalProps) {
  const isSingle = assets.length === 1

  let body: string
  let alertText: string

  if (isSingle) {
    switch (reason) {
      case DeleteBlockerReason.submissions:
        body = t('Projects with submissions cannot be deleted by Team members.')
        break
      case DeleteBlockerReason.permissions:
        body = t("You don't have permissions to delete projects from other Team members.")
        break
    }
    alertText = t('Only empty projects you created can be deleted as part of a Team.')
  } else {
    body = t('The following ##COUNT## projects cannot be deleted as part of a Team:').replace(
      '##COUNT##',
      String(blockedAssets?.length ?? 0),
    )
    alertText = t(
      'Some of these projects may have been created by other members or contain data. Only empty projects you created can be deleted.',
    )
  }

  const navigateToProject = (asset: AssetResponse | ProjectViewAsset) => {
    onRequestClose()
    router!.navigate(ROUTES.FORM_LANDING.replace(':uid', asset.uid))
  }

  return (
    <Stack gap='sm'>
      <Text size='sm'>{body}</Text>

      {!isSingle && blockedAssets && blockedAssets.length > 0 && (
        <ScrollArea.Autosize mah={150} type='auto' offsetScrollbars>
          <List
            type='unordered'
            pl='md'
            aria-label={t('Projects that cannot be deleted')}
            icon={
              <Text span aria-hidden size='sm' c='blue.4'>
                •
              </Text>
            }
          >
            {blockedAssets.map((asset) => (
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
