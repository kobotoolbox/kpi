import React, { useEffect, useMemo, useRef } from 'react'

import { PERMISSION_TREE } from '../../constants'
import { useInsightZenI18n } from '../../i18n/context'
import styles from '../../styles/PermissionTree.module.scss'

export type PermissionMap = Record<string, boolean | Record<string, boolean>>

interface PermissionTreeProps {
  value: PermissionMap
  onChange: (value: PermissionMap) => void
}

function toggleGroup(groupKey: keyof typeof PERMISSION_TREE, checked: boolean, value: PermissionMap): PermissionMap {
  const next = { ...value }
  next[groupKey] = Object.fromEntries(
    Object.keys(PERMISSION_TREE[groupKey].children).map((childKey) => [childKey, checked]),
  )
  return next
}

function toggleLeaf(
  groupKey: keyof typeof PERMISSION_TREE,
  childKey: string,
  checked: boolean,
  value: PermissionMap,
): PermissionMap {
  const group = (value[groupKey] as Record<string, boolean> | undefined) ?? {}
  return {
    ...value,
    [groupKey]: {
      ...group,
      [childKey]: checked,
    },
  }
}

function computeGroupState(groupKey: keyof typeof PERMISSION_TREE, value: PermissionMap) {
  const children = PERMISSION_TREE[groupKey].children
  const states = Object.keys(children).map((childKey) => {
    const group = value[groupKey] as Record<string, boolean> | undefined
    return group ? Boolean(group[childKey]) : false
  })
  const checkedCount = states.filter(Boolean).length
  return {
    all: checkedCount === states.length && states.length > 0,
    some: checkedCount > 0 && checkedCount < states.length,
  }
}

function PermissionGroup({
  groupKey,
  value,
  onChange,
}: {
  groupKey: keyof typeof PERMISSION_TREE
  value: PermissionMap
  onChange: (value: PermissionMap) => void
}) {
  const groupMeta = PERMISSION_TREE[groupKey]
  const { t } = useInsightZenI18n()
  const { all, some } = computeGroupState(groupKey, value)
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = some
    }
  }, [some])

  return (
    <div className={styles.group}>
      <label className={styles.groupLabel}>
        <input
          type='checkbox'
          ref={checkboxRef}
          checked={all}
          onChange={(event) => onChange(toggleGroup(groupKey, event.target.checked, value))}
        />
        <span>{t(groupMeta.labelKey)}</span>
      </label>
      <div className={styles.children}>
        {Object.entries(groupMeta.children).map(([childKey, label]) => {
          const groupValue = value[groupKey] as Record<string, boolean> | undefined
          const checked = groupValue ? Boolean(groupValue[childKey]) : false
          return (
            <label className={styles.childLabel} key={childKey}>
              <input
                type='checkbox'
                checked={checked}
                onChange={(event) => onChange(toggleLeaf(groupKey, childKey, event.target.checked, value))}
              />
              <span>{t(label)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function PermissionTree({ value, onChange }: PermissionTreeProps) {
  const groups = useMemo(() => Object.keys(PERMISSION_TREE) as Array<keyof typeof PERMISSION_TREE>, [])

  return (
    <div className={styles.tree}>
      {groups.map((groupKey) => (
        <PermissionGroup key={groupKey} groupKey={groupKey} value={value} onChange={onChange} />
      ))}
    </div>
  )
}
