import axios from 'axios';
import Cookies from 'universal-cookie';
import FileDownload from 'js-file-download';
import { API_ROOT_URL } from './client_config';

const cookies = new Cookies();

export const CRUISE_ROUTE = "/files/cruises";
export const LOWERING_ROUTE = "/files/lowerings";

export const authorizationHeader = { 
  headers: {
    Authorization: 'Bearer ' + cookies.get('token')
  }
}

const _buildQueryString = (queryDict) => {

	const queryStr = Object.entries(queryDict).reduce((acc, [key, value]) => {
      if(value !== null && value !== undefined) {
        if(value instanceof Array) {
          acc.push(...value.filter(element => element.trim() !== '').map(arrayValue => `${key}=${arrayValue.trim()}`));
        }
        else {
          acc.push(`${key}=${value}`);
        }
      }
      return acc;
    }, []).join('&');

  // console.debug("queryDict:", queryDict);
  // console.debug("queryStr:", queryStr);

  return queryStr;
}

const _errorNot404 = (error) => {
  if(error.response && error.response.data.statusCode !== 404){
    console.error('Problem connecting to API');
    console.debug(error.response);
  }
}

const _errorNot401 = (error) => {
  if(error.response && error.response.data.statusCode !== 401){
    console.error('Problem connecting to API');
    console.debug(error.response);
  }
}

const _handleFileDelete = async (filename, route, id, callback) => {

  await axios.delete(`${API_ROOT_URL}${route}/${id}/${filename}`,
    authorizationHeader
    ).then(async () => {
      await callback();
    }).catch((error)=>{
      console.error('Problem connecting to API');
      console.debug(error);
    });
}

const _handleFileDownload = async (filename, route, id) => {

  await axios.get(`${API_ROOT_URL}${route}/${id}/${filename}`,
    authorizationHeader
    ).then((response) => {
        FileDownload(response.data, filename);
     }).catch((error)=>{
      console.error('Problem connecting to API');
      console.debug(error);
    });
}

// Auth
export const post_login = async (payload) => {
  await axios.post(`${API_ROOT_URL}/api/v1/auth/login`, payload
    ).then(response => {

      return { success: true, data: response.data }
    }).catch((error)=>{
      console.debug(error);
      return { error }
    });
}

// Cruise
export const create_cruise = async (payload) => {
  return await axios.post(`${API_ROOT_URL}/api/v1/cruises`, payload,
    authorizationHeader
    ).then((response) => {
      return { success: true, data: response.data }
    }).catch((error) => {
      console.debug(error);
      return { error };
    });
}

export const delete_cruise = async (id) => {
  return await axios.delete(`${API_ROOT_URL}/api/v1/cruises/${id}`,
    authorizationHeader
    ).then(() => {
      return { success: true };
    }).catch((error) => {
      console.debug(error);
      return { error }
    });
}

export const get_cruises = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/cruises${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

export const update_cruise = async (payload, id) => {
  return await axios.patch(`${API_ROOT_URL}/api/v1/cruises/${id}`,
    payload,
    authorizationHeader
    ).then(() => {
      return { success: true }
    }).catch((error) => {
      _errorNot401(error);
      return { error }
    });

}

export const update_cruise_permissions = async (payload, id, callback) => {
  await axios.patch(`${API_ROOT_URL}/api/v1/cruises/${id}/permissions`,
    payload,
    authorizationHeader
    ).then(async () => {
      await callback();
    }).catch((error) => {
      _errorNot404(error);
    });
}

// Custom Var
export const get_custom_vars = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/custom_vars${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

export const update_custom_var = async (payload, id) => {
  await axios.patch(`${API_ROOT_URL}/api/v1/custom_vars/${id}`,
    payload,
    authorizationHeader
    ).catch((error)=>{
      _errorNot404(error);
    });
}

// Aux Data
export const get_event_aux_data = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/event_aux_data${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

export const get_event_aux_data_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/event_aux_data/bycruise/${id}?${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return [];
    });
}

// Event Exports
export const get_event_exports = async (queryDict={}, id=null) => {
	const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/event_exports${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

export const get_event_exports_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/event_exports/bycruise/${id}?${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return [];
    });
}

// Event Templatess
export const delete_event_template = async (id) => {
  return await axios.delete(`${API_ROOT_URL}/api/v1/event_templates/${id}`,
    authorizationHeader
    ).then(() => {
      return { success: true };
    }).catch((error) => {
      console.debug(error);
      return { error }
    });
}

export const get_event_templates = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/event_templates${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

// Events
export const delete_all_events = async () => {
  await axios.delete(`${API_ROOT_URL}/api/v1/events/all`,
    authorizationHeader
    ).catch((error)=> {
      console.debug(error.response);
    });
}

export const delete_event = async (id) => {
  return await axios.delete(`${API_ROOT_URL}/api/v1/events/${id}`,
    authorizationHeader
    ).then(() => {
      return { success: true };
    }).catch((error) => {
      console.debug(error);
      return { error }
    });
}

export const get_events = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/events${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

export const get_events_count = async (queryDict={}) => {
  const queryStr = _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/events/count?${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data.events;
    }).catch((error)=>{
      _errorNot404(error);
      return 0;
    });
}

export const get_events_by_cruise = async (queryDict, id) => {
  const queryStr = _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/events/bycruise/${id}?${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return [];
    });
}

export const update_event = async (payload, id) => {
  return await axios.patch(`${API_ROOT_URL}/api/v1/events/${id}`, payload,
    authorizationHeader
    ).then(() => {
      return { success: true }
    }).catch((error) => {
      _errorNot401(error);
      return { error }
    });

}

// Users
export const delete_user = async (id) => {
  return await axios.delete(`${API_ROOT_URL}/api/v1/users/${id}`,
    authorizationHeader
    ).then(() => {
      return { success: true };
    }).catch((error) => {
      console.debug(error);
      return { error }
    });
}

export const get_user_token = async (id) => {
  return await axios.get(`${API_ROOT_URL}/api/v1/users/${id}/token`,
    authorizationHeader
    ).then((response) => {
      return response.data.token;
    }).catch((error) => {
      _errorNot404(error);
      return null;
    })

}

export const get_users = async (queryDict={}, id=null) => {
  const queryStr = (id) ? `/${id}?` : '?' + _buildQueryString(queryDict);

  return await axios.get(`${API_ROOT_URL}/api/v1/users${queryStr}`,
    authorizationHeader
    ).then((response) => {
      return response.data;
    }).catch((error)=>{
      _errorNot404(error);
      return (id) ? null : [];
    });
}

// File-related
export const handleCruiseFileDelete = async (filename, cruise_id, callback) => {
  await _handleFileDelete(filename, CRUISE_ROUTE, cruise_id, callback);
}

export const handleLoweringFileDelete = async (filename, lowering_id, callback) => {
  await _handleFileDelete(filename, LOWERING_ROUTE, lowering_id, callback);
}

export const handleCruiseFileDownload = async (filename, cruise_id) => {
  await _handleFileDownload(filename, CRUISE_ROUTE, cruise_id);
}

export const handleLoweringFileDownload = async (filename, lowering_id) => {
  await _handleFileDownload(filename, LOWERING_ROUTE, lowering_id);
}
