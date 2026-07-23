import { Group, Input, Stack } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'

/** A single custom HTTP header: a name/value pair, e.g. `Authorization: Bearer …`. */
export interface CustomHeader {
  name: string
  value: string
}

/** Returns a fresh, blank header row. Handy as an initial value or when adding a row. */
export function getEmptyHeaderRow(): CustomHeader {
  return { name: '', value: '' }
}

interface RESTServicesCustomHeadersProps {
  headers: CustomHeader[]
  onChange: (headers: CustomHeader[]) => void
}

/**
 * The "Custom HTTP Headers" editor used inside the REST Service form. It renders
 * one name/value input pair per header, plus buttons to add and remove rows.
 *
 * This is a controlled component: it doesn't hold the headers itself. The parent
 * owns the `headers` array and passes a new one back through `onChange` on every
 * edit. That keeps a single source of truth in the parent form.
 */
export default function RESTServicesCustomHeaders({ headers, onChange }: RESTServicesCustomHeadersProps) {
  // Points at the <Stack> that wraps the rows, so we can find inputs inside it
  // (and only inside it) rather than searching the whole page.
  const containerRef = useRef<HTMLDivElement>(null)
  // Set when `addRow` runs, so the effect below focuses the newly added name
  // input once it's rendered (rather than querying the whole document).
  const shouldFocusLastRow = useRef(false)

  // After a row is added, move focus into the new row's name input. We do it in
  // an effect (not in `addRow`) because the new input doesn't exist in the DOM
  // until React re-renders. Keying on `headers.length` runs this right after
  // that render; the `shouldFocusLastRow` flag makes sure we only steal focus
  // when the user actually added a row, not on every headers change.
  useEffect(() => {
    if (!shouldFocusLastRow.current) {
      return
    }
    shouldFocusLastRow.current = false
    const inputs = containerRef.current?.querySelectorAll<HTMLInputElement>('input[name="headerName"]')
    inputs?.[inputs.length - 1]?.focus()
  }, [headers.length])

  const handleNameChange = (index: number, newName: string) => {
    onChange(headers.map((header, n) => (n === index ? { ...header, name: newName } : header)))
  }

  const handleValueChange = (index: number, newValue: string) => {
    onChange(headers.map((header, n) => (n === index ? { ...header, value: newValue } : header)))
  }

  const addRow = () => {
    shouldFocusLastRow.current = true
    onChange([...headers, getEmptyHeaderRow()])
  }

  const removeRow = (index: number) => {
    const newHeaders = headers.filter((_header, n) => n !== index)
    // Always keep at least one (empty) row so there's something to type into.
    if (newHeaders.length === 0) {
      newHeaders.push(getEmptyHeaderRow())
    }
    onChange(newHeaders)
  }

  return (
    <Input.Wrapper label={t('Custom HTTP Headers')}>
      <Stack ref={containerRef} gap='xs' mt='xxs'>
        {headers.map((header, n) => (
          <Group key={`headerName-${n}`} gap='xs' wrap='nowrap' align='center'>
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
