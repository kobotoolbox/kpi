import envStore from '#/envStore'

export const DOCS_PATHS = {
  HOME: '',
  INICIO_RAPIDO: 'guides/inicio-rapido/',
  EMPEZANDO: 'guides/empezando/',
  CONSTRUCTOR_FORMULARIOS: 'guides/constructor-formularios/',
  FORMULARIOS_XLSFORM: 'guides/formularios-excel-xlsform/',
  REFERENCE_XLSFORM: 'reference/xlsform/',
  RECOLECCION_DATOS: 'guides/recoleccion-datos-campo-web/',
  GESTION_PROYECTOS: 'guides/gestion-proyectos-datos/',
  ANALISIS_DATOS: 'guides/analisis-datos-reportes/',
  INTEGRACION_POWERBI_EXCEL: 'guides/integracion-powerbi-excel/',
  SEGURIDAD_PROTECCION: 'guides/seguridad-proteccion-datos/',
  CONFIGURACION_IDIOMAS: 'guides/configuracion-idiomas/',
} as const

export function getDocUrl(subpath: string = ''): string {
  const baseUrl = envStore.data.support_url || 'https://data.umsa.bo/docs/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath
  return `${normalizedBase}${normalizedSubpath}`
}
