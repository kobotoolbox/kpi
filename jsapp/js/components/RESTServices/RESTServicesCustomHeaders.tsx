import { Group, Input, Stack } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'

export interface CustomHeader {
  name: string
  value: string
}

export function getEmptyHeaderRow(): CustomHeader {
  return { name: '', value: '' }
}

interface RESTServicesCustomHeadersProps {
  headers: CustomHeader[]
  onChange: (headers: CustomHeader[]) => void
}

export default function RESTServicesCustomHeaders({ headers, onChange }: RESTServicesCustomHeadersProps) {
  const handleNameChange = (index: number, newName: string) => {
    onChange(headers.map((header, n) => (n === index ? { ...header, name: newName } : header)))
  }

  const handleValueChange = (index: number, newValue: string) => {
    onChange(headers.map((header, n) => (n === index ? { ...header, value: newValue } : header)))
  }

  const addRow = () => {
    onChange([...headers, getEmptyHeaderRow()])
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[name="headerName"]')
      inputs[inputs.length - 1]?.focus()
    }, 0)
  }

  const removeRow = (index: number) => {
    const newHeaders = headers.filter((_header, n) => n !== index)
    if (newHeaders.length === 0) {
      newHeaders.push(getEmptyHeaderRow())
    }
    onChange(newHeaders)
  }

  return (
    <Input.Wrapper label={t('Custom HTTP Headers')}>
      <Stack gap='xs' mt='xxs'>
        {headers.map((header, n) => (
          <Group key={n} gap='xs' wrap='nowrap' align='center'>
            <TextInput
              flex={1}
              placeholder={t('Name')}
              id={`headerName-${n}`}
              name='headerName'
              value={header.name}
              onChange={(evt) => handleNameChange(n, evt.currentTarget.value)}
              onKeyDown={(evt) => {
                // Pressing ENTER while editing the name moves focus to the value input
                if (evt.key === 'Enter') {
                  evt.preventDefault()
                  document.getElementById(`headerValue-${n}`)?.focus()
                }
              }}
            />

            <TextInput
              flex={1}
              placeholder={t('Value')}
              id={`headerValue-${n}`}
              name='headerValue'
              value={header.value}
              onChange={(evt) => handleValueChange(n, evt.currentTarget.value)}
              onKeyDown={(evt) => {
                // Pressing ENTER while editing the value adds a new row
                if (evt.key === 'Enter') {
                  evt.preventDefault()
                  addRow()
                }
              }}
            />

            <ActionIcon
              variant='danger-secondary'
              size='lg'
              icon={IconTrash}
              tooltip={t('Remove')}
              onClick={() => removeRow(n)}
            />
          </Group>
        ))}
      </Stack>

      <ButtonNew variant='light' size='sm' mt='sm' leftIcon={IconPlus} onClick={addRow}>
        {t('Add header')}
      </ButtonNew>
    </Input.Wrapper>
  )
}
