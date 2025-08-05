import { type FetchHttpMethod, fetchData } from './api';

interface RequestConfigInner {
  method: 'get' | 'put' | 'patch' | 'post' | 'delete';
  url: string;
  params?: any;
  data?: any;
  responseType?: string;
}


interface RequestConfigOuter {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  params?: any
  body?: any
  headers?: any
  responseType?: string
}

export const useKoboOrvalMutator = <T>(url: string, config: RequestConfigOuter): Promise<T> => {
  const { method, body, ...configRest} = config
  return fetchData<T>(url, method.toUpperCase() as FetchHttpMethod, body, {});
};

export default useKoboOrvalMutator
