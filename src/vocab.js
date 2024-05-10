// These constants build lowercase and titlecase versions of the cruise names
// Credit rgov (WHOIGit/ndsf-sealog-client)

import { CUSTOM_CRUISE_NAME } from './client_config'
import { toTitlecase } from './utils'

export const [_cruise_, _cruises_] = CUSTOM_CRUISE_NAME || ['cruise', 'cruises']

export const [_Cruise_, _Cruises_] = [toTitlecase(_cruise_), toTitlecase(_cruises_)]
