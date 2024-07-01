// These constants build lowercase and titlecase versions of the cruise names
// Credit rgov (WHOIGit/ndsf-sealog-client)

import { CUSTOM_CRUISE_NAME, AUX_DATA_DATASOURCE_REPLACE } from './client_config'
import { toTitlecase } from './utils'

export const [_cruise_, _cruises_] = CUSTOM_CRUISE_NAME || ['cruise', 'cruises']

export const [_Cruise_, _Cruises_] = [toTitlecase(_cruise_), toTitlecase(_cruises_)]

export const formatAuxDataSourceName = (datasourceName) => {
  return AUX_DATA_DATASOURCE_REPLACE[datasourceName] || datasourceName.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
}
