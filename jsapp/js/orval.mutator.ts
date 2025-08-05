import { type FetchHttpMethod, fetchDataRaw } from './api';

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

export const fetchWithKoboAuth = async <T>(url: string, config: RequestConfigOuter): Promise<T> => {
  const { method, body, ...configRest} = config
  const response = fetchDataRaw<T>(url, method.toUpperCase() as FetchHttpMethod, body, {});

  return response
};

export default fetchWithKoboAuth
