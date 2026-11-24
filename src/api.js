import axios from 'axios'
import moment from 'moment'
import { basename } from 'path'
import cookies from './cookies'
import FileDownload from 'js-file-download'
import { getImageUrl } from './utils'
import { API_ROOT_URL } from './client_settings'

export const CRUISE_ROUTE = '/files/cruises'
export const IMAGE_ROUTE = '/files/images'

export const authorizationHeader = () => {
  return {
    headers: {
      Authorization: 'Bearer ' + cookies.get('token')
    }
  }
}

const _buildQueryString = (queryDict) => {
  const queryStr = Object.entries(queryDict)
    .reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        if (value instanceof Array) {
          acc.push(...value.filter((element) => element.trim() !== '').map((arrayValue) => `${key}=${arrayValue.trim()}`))
        } else {
          acc.push(`${key}=${value}`)
        }
      }
      return acc
    }, [])
    .join('&')

  return queryStr
}

const _errorNot404 = (error) => {
  if (error.response && error.response.data.statusCode !== 404) {
    console.error('Problem connecting to API')
    console.debug(error.response)
  }
}

const _errorNot401 = (error) => {
  if (error.response && error.response.data.statusCode !== 401) {
    console.error('Problem connecting to API')
    console.debug(error.response)
  }
}

const _errorNot400 = (error) => {
  if (error.response && error.response.data.statusCode !== 400) {
    console.error('Problem connecting to API')
    console.debug(error.response)
  }
}

const _handleFileDelete = async (filename, route, id, callback) => {
  const url = id ? `${API_ROOT_URL}${route}/${id}/${filename}` : `${API_ROOT_URL}${route}/${filename}`

  await axios
    .delete(url, authorizationHeader())
    .then(async () => {
      await callback()
    })
    .catch((error) => {
      _errorNot401(error)
      console.debug(error)
    })
}

const _handleFileDownload = async (filename, route, id) => {
  const url = id ? `${API_ROOT_URL}${route}/${id}/${filename}` : `${API_ROOT_URL}${route}/${filename}`

  await axios
    .get(url, { ...authorizationHeader(), responseType: 'blob' })
    .then((response) => {
      FileDownload(response.data, filename)
    })
    .catch((error) => {
      _errorNot401(error)
      console.debug(error)
    })
}

const _handleImageDownload = async (image_path) => {
  await axios
    .get(getImageUrl(image_path), { ...authorizationHeader(), responseType: 'blob' })
    .then((response) => {
      FileDownload(response.data, basename(image_path))
    })
    .catch((error) => {
      _errorNot401(error)
      console.debug(error)
    })
}

// Auth
export const forgot_password = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/auth/forgotPassword`, payload)
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot401(error)
      return { error }
    })
}

export const get_profile = async () => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/auth/profile`, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot401(error)
      return { error }
    })
}

export const post_login = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/auth/login`, payload)
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const register_user = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/auth/register`, payload)
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const reset_password = async (payload) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/auth/resetPassword`, payload)
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const validate_jwt = async () => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/auth/validate`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot401(error)
      return { error }
    })
}

// Cruise
export const create_cruise = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/cruises`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_cruise = async (id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/cruises/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const export_cruise = async (id) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/external_calls/export_cruise/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const get_cruises = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/cruises${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const update_cruise = async (payload, id) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/cruises/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const update_cruise_permissions = async (payload, id, callback) => {
  await axios
    .patch(`${API_ROOT_URL}/api/v1/cruises/${id}/permissions`, payload, authorizationHeader())
    .then(async () => {
      await callback()
    })
    .catch((error) => {
      _errorNot400(error)
    })
}

// Custom Var
export const get_custom_vars = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/custom_vars${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot401(error)
      return id ? null : []
    })
}

export const update_custom_var = async (payload, id) => {
  await axios.patch(`${API_ROOT_URL}/api/v1/custom_vars/${id}`, payload, authorizationHeader()).catch((error) => {
    _errorNot400(error)
  })
}

// Aux Data
export const create_event_aux_data = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/event_aux_data`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_event_aux_data = async (id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/event_aux_data/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const get_event_aux_data = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/event_aux_data${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const get_event_aux_data_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/event_aux_data/bycruise/${id}?${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

export const update_event_aux_data = async (payload, id) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/event_aux_data/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Event Exports
export const get_event_exports = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/event_exports${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const get_event_exports_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/event_exports/bycruise/${id}?${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

// Event Templates
export const create_event_template = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/event_templates`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_event_template = async (id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/event_templates/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const get_event_templates = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/event_templates${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const update_event_template = async (payload, id) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/event_templates/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Events
export const create_event = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/events`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_all_events = async () => {
  await axios.delete(`${API_ROOT_URL}/api/v1/events/all`, authorizationHeader()).catch((error) => {
    console.debug(error.response)
  })
}

export const delete_event = async (id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/events/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const get_events = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/events${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const get_events_count = async (queryDict = {}) => {
  const queryStr = _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/events/count?${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data.events
    })
    .catch((error) => {
      _errorNot404(error)
      return 0
    })
}

export const get_events_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/events/bycruise/${id}?${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

export const get_events_count_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/events/bycruise/${id}/count?${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

export const update_event = async (payload, id) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/events/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Users
export const create_user = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/users`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_user = async (id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/users/${id}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const get_user_token = async (id) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/users/${id}/token`, authorizationHeader())
    .then((response) => {
      return response.data.token
    })
    .catch((error) => {
      _errorNot404(error)
      return null
    })
}

export const get_users = async (queryDict = {}, id = null) => {
  const queryStr = id ? `/${id}?` : '?' + _buildQueryString(queryDict)

  return await axios
    .get(`${API_ROOT_URL}/api/v1/users${queryStr}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return id ? null : []
    })
}

export const update_user = async (payload, id) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/users/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Vocabularies
// The ID sequences (sealog-server lib/sequences.js)
export const get_sequences = async () => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/sequences`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

export const create_sequence = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/sequences`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const update_sequence = async (name, payload) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/sequences/${encodeURIComponent(name)}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_sequence = async (name) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/sequences/${encodeURIComponent(name)}`, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// [{ scope_key, last, next }], one per cruise or lowering (or '' for global)
export const get_sequence_counters = async (name) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/sequences/${encodeURIComponent(name)}/counters`, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot404(error)
      return { error }
    })
}

export const set_sequence_counter = async (name, scope_key, next) => {
  return await axios
    .put(`${API_ROOT_URL}/api/v1/sequences/${encodeURIComponent(name)}/counters`, { scope_key, next }, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Download the sequence definitions (no counters) as a .json file
export const export_sequences = async () => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/sequences/export`, authorizationHeader())
    .then((response) => {
      FileDownload(JSON.stringify(response.data, null, 2), `sealog_sequences_${moment.utc().format('YYYYMMDD')}.json`)
      return { success: true }
    })
    .catch((error) => {
      _errorNot401(error)
      return { error }
    })
}

// Import sequence definitions from a .json file: { created, updated }
export const import_sequences = async (file) => {
  let definitions
  try {
    definitions = JSON.parse(await file.text())
  } catch (err) {
    return { error: { message: `${file.name} isn't JSON` } }
  }

  return await axios
    .post(`${API_ROOT_URL}/api/v1/sequences/import`, definitions, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// The ID a sequence would give the next event at ts, without taking it:
// { data: { id, n, scope_key, prefix, suffix } } or { error: message }
export const get_sequence_next = async (name, ts) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/sequences/${encodeURIComponent(name)}/next`, { ...authorizationHeader(), params: { ts } })
    .then((response) => {
      return { data: response.data }
    })
    .catch((error) => {
      return { error: (error.response && error.response.data && error.response.data.message) || 'Unable to reach server' }
    })
}

export const get_vocabularies = async () => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/vocabularies`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return []
    })
}

// Terms of a vocabulary; null if it isn't cached. Pass include_hidden and
// include_deprecated to get every term.
export const get_vocabulary_terms = async (code, queryDict = {}) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/vocabularies/${code}/terms?${_buildQueryString(queryDict)}`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return null
    })
}

export const get_vocabulary_visibility = async (code) => {
  return await axios
    .get(`${API_ROOT_URL}/api/v1/vocabularies/${code}/visibility`, authorizationHeader())
    .then((response) => {
      return response.data
    })
    .catch((error) => {
      _errorNot404(error)
      return null
    })
}

export const set_vocabulary_visibility = async (code, payload) => {
  return await axios
    .put(`${API_ROOT_URL}/api/v1/vocabularies/${code}/visibility`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Terms of local vocabularies
export const create_vocabulary_term = async (code, payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/vocabularies/${code}/terms`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const update_vocabulary_term = async (code, id, payload) => {
  return await axios
    .patch(`${API_ROOT_URL}/api/v1/vocabularies/${code}/terms/${id}`, payload, authorizationHeader())
    .then(() => {
      return { success: true }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Resolves to { id, action: 'deleted' | 'deprecated' }: a term recorded on
// events is deprecated instead of deleted
export const delete_vocabulary_term = async (code, id) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/vocabularies/${code}/terms/${id}`, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const create_vocabulary = async (payload) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/vocabularies`, payload, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const delete_vocabulary = async (code) => {
  return await axios
    .delete(`${API_ROOT_URL}/api/v1/vocabularies/${code}`, authorizationHeader())
    .then((response) => {
      // 200 with { action: 'retained', retained } when events keep some terms
      return { success: true, data: response.data || null }
    })
    .catch((error) => {
      console.debug(error)
      return { error }
    })
}

export const refresh_vocabulary = async (code) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/vocabularies/${code}/refresh`, null, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

export const add_vocabulary_source = async (code, url) => {
  return await axios
    .post(`${API_ROOT_URL}/api/v1/vocabularies/${code}/source`, { url }, authorizationHeader())
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// Download a vocabulary bundle: every vocabulary, or only those in collections
export const export_vocabularies = async (collections = []) => {
  const queryStr = _buildQueryString({ collection: collections })
  const filename = `sealog_vocabularies${collections.length === 1 ? `_${collections[0]}` : ''}_${moment.utc().format('YYYYMMDD')}.json`

  return await axios
    .get(`${API_ROOT_URL}/api/v1/vocabularies/export?${queryStr}`, { ...authorizationHeader(), responseType: 'blob' })
    .then((response) => {
      FileDownload(response.data, filename)
      return { success: true }
    })
    .catch((error) => {
      _errorNot401(error)
      return { error }
    })
}

// Load a vocabulary bundle from a .json or gzipped .json.gz file
export const import_vocabularies = async (file) => {
  let data = await file.arrayBuffer()
  const bytes = new Uint8Array(data)

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  }

  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(data))
  } catch (err) {
    return { error: new Error(`${file.name} is not a JSON file`) }
  }

  return await axios
    .post(`${API_ROOT_URL}/api/v1/vocabularies/import`, payload, { ...authorizationHeader(), maxBodyLength: Infinity })
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((error) => {
      _errorNot400(error)
      return { error }
    })
}

// File-related
export const handle_cruise_file_delete = async (filename, cruise_id, callback) => {
  await _handleFileDelete(filename, CRUISE_ROUTE, cruise_id, callback)
}

export const handle_cruise_file_download = async (filename, cruise_id) => {
  await _handleFileDownload(filename, CRUISE_ROUTE, cruise_id)
}

export const handle_image_file_delete = async (filename, callback) => {
  await _handleFileDelete(filename, IMAGE_ROUTE, null, callback)
}

export const handle_image_file_download = async (image_path) => {
  await _handleImageDownload(image_path)
}
