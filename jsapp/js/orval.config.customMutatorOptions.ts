import { type UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import type {
  useAccessLogsExportCreateMutationOptions,
  useAccessLogsMeExportCreateMutationOptions,
} from './api/access-logs'
import type {
  useAssetsPermissionAssignmentsBulkCreateMutationOptions,
  useAssetsPermissionAssignmentsClonePartialUpdateMutationOptions,
  useAssetsPermissionAssignmentsCreateMutationOptions,
  useAssetsPermissionAssignmentsDeleteAllDestroyMutationOptions,
  useAssetsPermissionAssignmentsDestroyMutationOptions,
} from './api/asset-permission-assignments'
import type {
  useAssetSnapshotsCreateMutationOptions,
  useAssetSnapshotsDestroyMutationOptions,
} from './api/asset-snapshots'
import type {
  useAssetSubscriptionsCreateMutationOptions,
  useAssetSubscriptionsDestroyMutationOptions,
} from './api/asset-subscriptions'
import type {
  useAssetsBulkCreateMutationOptions,
  useAssetsCreateMutationOptions,
  useAssetsDestroyMutationOptions,
  useAssetsPartialUpdateMutationOptions,
} from './api/assets'
import type {
  useAssetsAttachmentsBulkDestroyMutationOptions,
  useAssetsAttachmentsDestroyMutationOptions,
} from './api/attachments'
import type {
  useAssetsDataBulkDestroyMutationOptions,
  useAssetsDataBulkPartialUpdateMutationOptions,
  useAssetsDataDestroyMutationOptions,
  useAssetsDataDuplicateCreateMutationOptions,
  useAssetsDataValidationStatusDestroyMutationOptions,
  useAssetsDataValidationStatusPartialUpdateMutationOptions,
  useAssetsDataValidationStatusesDestroyMutationOptions,
  useAssetsDataValidationStatusesPartialUpdateMutationOptions,
} from './api/data'
import type {
  useAssetsDeploymentCreateMutationOptions,
  useAssetsDeploymentPartialUpdateMutationOptions,
} from './api/deployment'
import type {
  useAssetsExportSettingsCreateMutationOptions,
  useAssetsExportSettingsDestroyMutationOptions,
  useAssetsExportSettingsPartialUpdateMutationOptions,
} from './api/export-settings'
import type { useAssetsExportsCreateMutationOptions, useAssetsExportsDestroyMutationOptions } from './api/exports'
import type { useAssetsFilesCreateMutationOptions, useAssetsFilesDestroyMutationOptions } from './api/files'
import type { useFormUploadCreateMutationOptions } from './api/form-upload'
import type { useAssetsHistoryExportCreateMutationOptions } from './api/history'
import type { useImportsCreateMutationOptions } from './api/imports'
import type { useMeDestroyMutationOptions, useMePartialUpdateMutationOptions } from './api/me'
import type { ErrorDetail } from './api/models/errorDetail'
import type { ErrorObject } from './api/models/errorObject'
import type {
  useAssetSnapshotsSubmissionCreate2MutationOptions,
  useAssetSnapshotsSubmissionCreateMutationOptions,
} from './api/open-rosa'
import type {
  useOrganizationsInvitesCreateMutationOptions,
  useOrganizationsInvitesDestroyMutationOptions,
  useOrganizationsInvitesPartialUpdateMutationOptions,
} from './api/organization-invites'
import type {
  useOrganizationsMembersDestroyMutationOptions,
  useOrganizationsMembersPartialUpdateMutationOptions,
} from './api/organization-members'
import type { useOrganizationsPartialUpdateMutationOptions } from './api/organizations'
import type {
  useAssetsPairedDataCreateMutationOptions,
  useAssetsPairedDataDestroyMutationOptions,
  useAssetsPairedDataPartialUpdateMutationOptions,
} from './api/paired-data'
import type { useProjectHistoryLogsExportCreateMutationOptions } from './api/project-history-logs'
import type {
  useProjectOwnershipInvitesCreateMutationOptions,
  useProjectOwnershipInvitesDestroyMutationOptions,
  useProjectOwnershipInvitesPartialUpdateMutationOptions,
} from './api/project-ownership-invites'
import type { useProjectViewsExportCreateMutationOptions } from './api/project-views'
import type {
  useAssetsHooksCreateMutationOptions,
  useAssetsHooksDestroyMutationOptions,
  useAssetsHooksLogsRetryPartialUpdateMutationOptions,
  useAssetsHooksPartialUpdateMutationOptions,
  useAssetsHooksRetryPartialUpdateMutationOptions,
} from './api/rest-services'
import type { useSubmissionCreate2MutationOptions, useSubmissionCreateMutationOptions } from './api/submission'
import type { useUploadCreateMutationOptions } from './api/upload'

interface DefaultMutationKeyMap {
  accessLogsExportCreate: ReturnType<typeof useAccessLogsExportCreateMutationOptions>
  accessLogsMeExportCreate: ReturnType<typeof useAccessLogsMeExportCreateMutationOptions>
  assetsPermissionAssignmentsCreate: ReturnType<typeof useAssetsPermissionAssignmentsCreateMutationOptions>
  assetsPermissionAssignmentsDestroy: ReturnType<typeof useAssetsPermissionAssignmentsDestroyMutationOptions>
  assetsPermissionAssignmentsDeleteAllDestroy: ReturnType<
    typeof useAssetsPermissionAssignmentsDeleteAllDestroyMutationOptions
  >
  assetsPermissionAssignmentsBulkCreate: ReturnType<typeof useAssetsPermissionAssignmentsBulkCreateMutationOptions>
  assetsPermissionAssignmentsClonePartialUpdate: ReturnType<
    typeof useAssetsPermissionAssignmentsClonePartialUpdateMutationOptions
  >
  assetSnapshotsCreate: ReturnType<typeof useAssetSnapshotsCreateMutationOptions>
  assetSnapshotsDestroy: ReturnType<typeof useAssetSnapshotsDestroyMutationOptions>
  assetSubscriptionsCreate: ReturnType<typeof useAssetSubscriptionsCreateMutationOptions>
  assetSubscriptionsDestroy: ReturnType<typeof useAssetSubscriptionsDestroyMutationOptions>
  assetsCreate: ReturnType<typeof useAssetsCreateMutationOptions>
  assetsPartialUpdate: ReturnType<typeof useAssetsPartialUpdateMutationOptions>
  assetsDestroy: ReturnType<typeof useAssetsDestroyMutationOptions>
  assetsBulkCreate: ReturnType<typeof useAssetsBulkCreateMutationOptions>
  assetsAttachmentsDestroy: ReturnType<typeof useAssetsAttachmentsDestroyMutationOptions>
  assetsAttachmentsBulkDestroy: ReturnType<typeof useAssetsAttachmentsBulkDestroyMutationOptions>
  assetsDataDestroy: ReturnType<typeof useAssetsDataDestroyMutationOptions>
  assetsDataDuplicateCreate: ReturnType<typeof useAssetsDataDuplicateCreateMutationOptions>
  assetsDataValidationStatusPartialUpdate: ReturnType<typeof useAssetsDataValidationStatusPartialUpdateMutationOptions>
  assetsDataValidationStatusDestroy: ReturnType<typeof useAssetsDataValidationStatusDestroyMutationOptions>
  assetsDataBulkPartialUpdate: ReturnType<typeof useAssetsDataBulkPartialUpdateMutationOptions>
  assetsDataBulkDestroy: ReturnType<typeof useAssetsDataBulkDestroyMutationOptions>
  assetsDataValidationStatusesPartialUpdate: ReturnType<
    typeof useAssetsDataValidationStatusesPartialUpdateMutationOptions
  >
  assetsDataValidationStatusesDestroy: ReturnType<typeof useAssetsDataValidationStatusesDestroyMutationOptions>
  assetsDeploymentCreate: ReturnType<typeof useAssetsDeploymentCreateMutationOptions>
  assetsDeploymentPartialUpdate: ReturnType<typeof useAssetsDeploymentPartialUpdateMutationOptions>
  assetsExportSettingsCreate: ReturnType<typeof useAssetsExportSettingsCreateMutationOptions>
  assetsExportSettingsPartialUpdate: ReturnType<typeof useAssetsExportSettingsPartialUpdateMutationOptions>
  assetsExportSettingsDestroy: ReturnType<typeof useAssetsExportSettingsDestroyMutationOptions>
  assetsExportsCreate: ReturnType<typeof useAssetsExportsCreateMutationOptions>
  assetsExportsDestroy: ReturnType<typeof useAssetsExportsDestroyMutationOptions>
  assetsFilesCreate: ReturnType<typeof useAssetsFilesCreateMutationOptions>
  assetsFilesDestroy: ReturnType<typeof useAssetsFilesDestroyMutationOptions>
  formUploadCreate: ReturnType<typeof useFormUploadCreateMutationOptions>
  assetsHistoryExportCreate: ReturnType<typeof useAssetsHistoryExportCreateMutationOptions>
  importsCreate: ReturnType<typeof useImportsCreateMutationOptions>
  mePartialUpdate: ReturnType<typeof useMePartialUpdateMutationOptions>
  meDestroy: ReturnType<typeof useMeDestroyMutationOptions>
  assetSnapshotsSubmissionCreate: ReturnType<typeof useAssetSnapshotsSubmissionCreateMutationOptions>
  assetSnapshotsSubmissionCreate2: ReturnType<typeof useAssetSnapshotsSubmissionCreate2MutationOptions>
  organizationsInvitesCreate: ReturnType<typeof useOrganizationsInvitesCreateMutationOptions>
  organizationsInvitesPartialUpdate: ReturnType<typeof useOrganizationsInvitesPartialUpdateMutationOptions>
  organizationsInvitesDestroy: ReturnType<typeof useOrganizationsInvitesDestroyMutationOptions>
  organizationsMembersPartialUpdate: ReturnType<typeof useOrganizationsMembersPartialUpdateMutationOptions>
  organizationsMembersDestroy: ReturnType<typeof useOrganizationsMembersDestroyMutationOptions>
  organizationsPartialUpdate: ReturnType<typeof useOrganizationsPartialUpdateMutationOptions>
  assetsPairedDataCreate: ReturnType<typeof useAssetsPairedDataCreateMutationOptions>
  assetsPairedDataPartialUpdate: ReturnType<typeof useAssetsPairedDataPartialUpdateMutationOptions>
  assetsPairedDataDestroy: ReturnType<typeof useAssetsPairedDataDestroyMutationOptions>
  projectHistoryLogsExportCreate: ReturnType<typeof useProjectHistoryLogsExportCreateMutationOptions>
  projectOwnershipInvitesCreate: ReturnType<typeof useProjectOwnershipInvitesCreateMutationOptions>
  projectOwnershipInvitesPartialUpdate: ReturnType<typeof useProjectOwnershipInvitesPartialUpdateMutationOptions>
  projectOwnershipInvitesDestroy: ReturnType<typeof useProjectOwnershipInvitesDestroyMutationOptions>
  projectViewsExportCreate: ReturnType<typeof useProjectViewsExportCreateMutationOptions>
  assetsHooksCreate: ReturnType<typeof useAssetsHooksCreateMutationOptions>
  assetsHooksLogsRetryPartialUpdate: ReturnType<typeof useAssetsHooksLogsRetryPartialUpdateMutationOptions>
  assetsHooksPartialUpdate: ReturnType<typeof useAssetsHooksPartialUpdateMutationOptions>
  assetsHooksDestroy: ReturnType<typeof useAssetsHooksDestroyMutationOptions>
  assetsHooksRetryPartialUpdate: ReturnType<typeof useAssetsHooksRetryPartialUpdateMutationOptions>
  submissionCreate2: ReturnType<typeof useSubmissionCreate2MutationOptions>
  submissionCreate: ReturnType<typeof useSubmissionCreateMutationOptions>
  uploadCreate: ReturnType<typeof useUploadCreateMutationOptions>
}

// type MutationKeySpecific = ['dashboard' | 'marketing']
// declare module '@tanstack/react-query' {
//   interface Register {
//     mutationKey: MutationKeySpecific
//   }
// }

type Options<T = unknown, TError = unknown, TData = unknown, TContext = unknown> = UseMutationOptions<
  T,
  TError,
  TData,
  TContext
> &
  Required<Pick<UseMutationOptions<T, TError, TData, TContext>, 'mutationFn'>>

export type UseMutationOptionsFactory = <TError = ErrorDetail | ErrorObject, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<unknown, TError, Record<string, unknown>, TContext>
  fetch?: RequestInit
}) => UseMutationOptions<unknown, TError, Record<string, unknown>, TContext>

export const getCustomMutatorOptions = <T, TError, TData, TContext>(
  options: Options<T, TError, TData, TContext>,
): Options<T, TError, TData, TContext> => {
  if (!options.mutationKey) return options // typeguard
  if (options.meta?.customize === false) return options

  const queryClient = useQueryClient()

  let count = 0
  // const typer = <TM extends (options?: {}) => { mutationKey?: MutationKey }>(
  //   useMutationOptions: TM,
  //   optionsFn: (options: ReturnType<typeof useMutationOptions>) => ReturnType<typeof useMutationOptions>,
  // ) => {
  //   const mutationKey = useMutationOptions({ mutation: { meta: { customize: false } } }).mutationKey
  //   if (options.mutationKey !== mutationKey) return
  //   count++

  //   options = optionsFn(options as ReturnType<typeof useMutationOptions>) as Options<T, TError, TData, TContext>
  // }

  // switch(options.mutationKey[0] as DefaultMutationKey) {
  //   case('organizationsInvitesDestroy'): {
  //     options.onSuccess = (_data, variables) => {
  //       queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
  //       queryClient.invalidateQueries({ queryKey: ['qwe'] })
  //       queryClient.invalidateQueries({
  //         queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
  //       })
  //     }
  //     return options
  //   }
  //   default: {
  //     // Do nothing, aka apply default options only to default keys.
  //   }
  // }

  // const asdf = 'asdf' as ReturnType<typeof useOrganizationsInvitesDestroyMutationOptions>['mutationKey'][0]

  // typer(useOrganizationsInvitesDestroyMutationOptions, (options) => {
  //   options.onSuccess = (_data, variables) => {
  //     queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
  //     queryClient.invalidateQueries({ queryKey: ['qwe'] })
  //     queryClient.invalidateQueries({
  //       queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
  //     })
  //   }
  //   return options
  // })

  const customizeIf = <TM extends keyof DefaultMutationKeyMap>(
    mutationKey: TM,
    optionsFn: (options: DefaultMutationKeyMap[TM]) => DefaultMutationKeyMap[TM],
  ) => {
    if (options.mutationKey?.[0] !== mutationKey) return
    count++

    // Note: lazy typecasting here, doesn't matter to get the types super correct here.
    options = optionsFn(options as unknown as DefaultMutationKeyMap[typeof mutationKey]) as unknown as Options<
      T,
      TError,
      TData,
      TContext
    >
  }
  customizeIf('organizationsInvitesDestroy', (options) => {
    // options.onSuccess = (_data, variables) => {
    //   queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
    //   queryClient.invalidateQueries({
    //     queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
    //   })
    // }
    return options
  })

  if (count === 0) {
    console.error(`Internal Error: A mutation "${options.mutationKey}" doesn't have an invalidation customization.`)
  }
  if (count > 1) {
    console.error(`Internal Error: A mutation "${options.mutationKey}" has ${count} customizations instead of 1.`)
  }

  return options
}
