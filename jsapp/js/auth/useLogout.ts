import { useAllauthBrowserV1AuthSessionDelete } from '#/api/react-query/authentication-allauth-headless'

export const useLogout = () => useAllauthBrowserV1AuthSessionDelete()
