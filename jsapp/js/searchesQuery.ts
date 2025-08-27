import {useMutation, useQueryClient} from "@tanstack/react-query";
import {fetchGet} from "./api";
import {endpoints} from "./api.endpoints";

export default async function getSearches() {
  return {
    status: 200 as const,
    data: await fetchGet(endpoints.SEARCHES),
  }
}
