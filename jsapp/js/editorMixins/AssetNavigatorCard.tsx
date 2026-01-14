import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import React from 'react'
import type { Asset } from '#/api/models/asset'
import { AssetTypeEnum } from '#/api/models/assetTypeEnum'
import Icon from '#/components/common/icon'

interface AssetNavigatorCardProps {
  asset: Asset
  className: string
  isExpanded: boolean
}

export default function AssetNavigatorCard(props: AssetNavigatorCardProps) {
  const isBlock = props.asset.asset_type === AssetTypeEnum.block
  // Accessing properties safely based on the Asset interface
  const summary = props.asset.summary || {}
  const rowCount = summary.row_count
  const labels = summary.labels || []
  // This is the same thing we do in `assetParserUtils.ts`
  const tags = props.asset.tag_string?.split(',').filter((tg) => tg.length !== 0) || []

  return (
    <Card
      shadow='sm'
      padding='xs'
      radius='md'
      withBorder
      className={props.className}
      style={{ cursor: 'grab' }}
      // Needeed for `sortable`, see `activateSortable` in `jsapp/xlform/src/view.surveyApp.coffee`
      data-uid={props.asset.uid}
    >
      <Group align='flex-start' wrap='nowrap' gap='xs'>
        {/* We have a drag handle here, but in fact the whole card is draggable */}
        <Icon name='drag-handle' size='xs' />

        <Stack gap={4} style={{ flexGrow: 1 }}>
          {/* Asset Name */}
          <Text fw={500} size='sm' lineClamp={1}>
            {props.asset.name}
          </Text>

          {/* Block Details */}
          {isBlock && rowCount !== undefined && <Text size='xs'>Block of {rowCount} questions</Text>}

          {/* Expanded Details: Block Labels */}
          {props.isExpanded && isBlock && labels.length > 0 && (
            <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem' }}>
              {labels.map((label: string, idx: number) => (
                <li key={`${idx}-${label}`}>{label}</li>
              ))}
            </ol>
          )}

          {/* Expanded Details: Tags */}
          {props.isExpanded && tags.length > 0 && (
            <Group gap={4} mt={4}>
              {tags.map((tag: string) => (
                <Badge key={tag} size='xs' variant='outline' color='gray'>
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Group>
    </Card>
  )
}
