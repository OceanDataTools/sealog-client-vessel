import axios from 'axios';
import Cookies from 'universal-cookie';
import { push } from 'connected-react-router';
import { show } from 'redux-modal';
import { change, untouch } from 'redux-form';
import { API_ROOT_URL } from '../client_config';
import {
  create_cruise,
  delete_cruise,
  delete_event_template,
  delete_event,
  delete_user,
  get_cruises,
  get_event_exports,
  get_event_templates,
  get_events,
  get_events_by_cruise,
  get_users,
  post_login,
  update_cruise,
  update_event
} from '../api';

import {
  AUTH_ERROR,
  AUTH_SUCCESS,
  AUTH_USER,
  CLEAR_SELECTED_EVENT,
  CREATE_CRUISE_ERROR,
  CREATE_CRUISE_SUCCESS,
  CREATE_EVENT_TEMPLATE_ERROR,
  CREATE_EVENT_TEMPLATE_SUCCESS,
  CREATE_USER_ERROR,
  CREATE_USER_SUCCESS,
  EVENT_FETCHING,
  FETCH_CRUISES,
  FETCH_EVENT_TEMPLATES,
  FETCH_EVENT_TEMPLATES_FOR_MAIN,
  FETCH_EVENTS,
  FETCH_FILTERED_EVENTS,
  FETCH_USERS,
  HIDE_ASNAP,
  INIT_CRUISE,
  INIT_EVENT,
  INIT_EVENT_TEMPLATE,
  INIT_USER,
  LEAVE_AUTH_LOGIN_FORM,
  LEAVE_CRUISE_FORM,
  LEAVE_EVENT_FILTER_FORM,
  LEAVE_EVENT_TEMPLATE_FORM,
  LEAVE_REGISTER_USER_FORM,
  LEAVE_UPDATE_PROFILE_FORM,
  LEAVE_USER_FORM,
  REGISTER_USER_ERROR,
  REGISTER_USER_SUCCESS,
  SET_SELECTED_EVENT,
  SHOW_ASNAP,
  UNAUTH_USER,
  UPDATE_CRUISE_ERROR,
  UPDATE_CRUISE_SUCCESS,
  UPDATE_EVENT,
  UPDATE_EVENT_FILTER_FORM,
  UPDATE_EVENT_TEMPLATE_CATEGORY,
  UPDATE_EVENT_TEMPLATE_ERROR,
  UPDATE_EVENT_TEMPLATE_SUCCESS,
  UPDATE_EVENTS,
  UPDATE_PROFILE,
  UPDATE_PROFILE_ERROR,
  UPDATE_PROFILE_SUCCESS,
  UPDATE_USER_ERROR,
  UPDATE_USER_SUCCESS,

} from './types';

const cookies = new Cookies();

const port = (window.location.port) ? ':' + window.location.port : '';
const resetURL = window.location.protocol + '//' + window.location.hostname + port + '/resetPassword/';

export const authorizationHeader = {
  headers: {
    Authorization: 'Bearer ' + cookies.get('token')
  }
}

export const advanceCruiseReplayTo = (id) => {
  return async (dispatch) => {
    const payload = await get_event_exports({}, id) || {};

    return dispatch({ type: SET_SELECTED_EVENT, payload });
  };
}

export const authError = (error) => {
  return {
    type: AUTH_ERROR,
    payload: error
  };
}

export const authSuccess = (message) => {
  return {
    type: AUTH_SUCCESS,
    payload: message
  };
}

export const autoLogin = ({loginToken, reCaptcha = null}) => {

  const payload = (reCaptcha !== null)? {loginToken, reCaptcha} : {loginToken};

  return async (dispatch) => {
    const response = await post_login(payload);
    if (response.success) {
      cookies.set('token', response.data.token, { path: '/' });
      cookies.set('id', response.data.id, { path: '/' });
      dispatch({ type: AUTH_USER });
      return dispatch(updateProfileState());
    }
    else {
      if(response.error.response && response.error.response.status !== 401) {
        // If request is unauthenticated
        return dispatch(authError(response.error.response.data.message));
      }
      else if(response.error.message == "Network Error") {
        return dispatch(authError("Unable to connect to server"));
      }
      return dispatch(authError(response.error.response.data.message));
    }
  };
}

export const clearEvents = () => {
  return (dispatch) => {
    return dispatch({type: UPDATE_EVENTS, payload: []});
  };
}

export const clearSelectedCruise = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_CRUISE_FORM, payload: null});
  };
}

export const clearSelectedEvent = () => {
  return (dispatch) => {
    return dispatch({type: CLEAR_SELECTED_EVENT, payload: null});
  };
}

export const createCruise = (formProps) => {

  return async (dispatch) => {
    const response = await create_cruise(formProps)
    if(response.success) {
      dispatch(initCruise(response.data.insertedId));
        dispatch(createCruiseSuccess('Cruise created'));
        return dispatch(fetchCruises());
    }
    return dispatch(createCruiseError(response.error.response.data.message));
  }
}

export const createCruiseError = (message) => {
  return {
    type: CREATE_CRUISE_ERROR,
    payload: message
  };
}

export const createCruiseSuccess = (message) => {
  return {
    type: CREATE_CRUISE_SUCCESS,
    payload: message
  };
}

export const createEvent = (eventValue, eventFreeText = '', eventOptions = [], eventTS = '', publish = true) => {

  return async () => {
    try {
      const event = await createEventRequest(eventValue, eventFreeText, eventOptions, eventTS, publish);
      return event;
    } catch (error) {
      console.debug(error);
    }
  };
}

export const createEventRequest = async (eventValue, eventFreeText, eventOptions, eventTS, publish) => {

  let payload = {
    event_value: eventValue,
    event_free_text: eventFreeText,
    event_options: eventOptions,
    publish
  };

  if(eventTS.length > 0){
    payload.ts = eventTS;
  }

  return await axios.post(`${API_ROOT_URL}/api/v1/events`,
    payload,
    {
      headers: { Authorization: 'Bearer ' + cookies.get('token') }
    }).then((response) => {
      return response.data.insertedEvent;
    })
    .catch((error)=>{
      console.debug(error);
    });
}

export const createEventTemplate = (formProps) => {

  let fields = { ...formProps };

  return async (dispatch) => {
    return await axios.post(`${API_ROOT_URL}/api/v1/event_templates`, fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then((response) => {
        dispatch(initEventTemplate(response.data.insertedId));
        dispatch(createEventTemplateSuccess('Event Template created'));
        return dispatch(fetchEventTemplates());
      }).catch((error) => {
        console.debug(error);
        // If request is unauthenticated
        return dispatch(createEventTemplateError(error.response.data.message));
      });
  };
}

export const createEventTemplateError = (message) => {
  return {
    type: CREATE_EVENT_TEMPLATE_ERROR,
    payload: message
  };
}

export const createEventTemplateSuccess = (message) => {
  return {
    type: CREATE_EVENT_TEMPLATE_SUCCESS,
    payload: message
  };
}

export const createUser = (formProps) => {

  let fields = { ...formProps, resetURL };

  return async (dispatch) => {
    return await axios.post(`${API_ROOT_URL}/api/v1/users`, fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then((response) => {
        dispatch(initUser(response.data.insertedId));
        dispatch(createUserSuccess('User created'));
        return dispatch(fetchUsers());
      }).catch((error) => {
      // If request is unauthenticated
        console.debug(error);
        return dispatch(createUserError(error.response.data.message));
      });
  };
}

export const createUserError = (message) => {
  return {
    type: CREATE_USER_ERROR,
    payload: message
  };
}

export const createUserSuccess = (message) => {
  return {
    type: CREATE_USER_SUCCESS,
    payload: message
  };
}

export const deleteAllNonSystemEventTemplates = () => {
  return async (dispatch) => {

    const query = {
      system_template: false
    }

    const event_templates = await get_event_templates(query)
    event_templates.map(async (event_template) => {
      await dispatch(deleteEventTemplate(event_template.id, false));
    });

    return dispatch(fetchEventTemplates());
  };
}

export const deleteAllNonSystemUsers = () => {
  return async (dispatch) => {

    const query = {
      system_user: false
    }

    const users = await get_users(query)
    users.map(async (user) => {
      await dispatch(deleteUser(user.id, false));
    });

    return dispatch(fetchUsers());
  };
}

export const deleteCruise = (id) => {
  return async (dispatch, getState) => {
    const response = await delete_cruise(id);
    if(response.success){
      if(getState().cruise.cruise.id === id) {
        dispatch(leaveCruiseForm());
      }
      return dispatch(fetchCruises())
    }
  };
}

export const deleteEvent = (event_id) => {
  return async () => {
      return await deleteEventRequest(event_id);
  };
}

export const deleteEventRequest = async (event_id) => {
  return await delete_event(event_id)
}

export const deleteEventTemplate = (id) => {

  return async (dispatch, getState) => {
    const response = await delete_event_template(id);

    if(response.success) {
      if(getState().event_template.event_template.id === id) {
        dispatch(leaveEventTemplateForm());
      }
      return dispatch(fetchEventTemplates());
    }
  }
}

export const deleteUser = (id) => {

  return async (dispatch, getState) => {
    const response = await delete_user(id);

    if(response.success) {
      if(getState().user.user.id === id) {
        dispatch(leaveUserForm());
      }
      return dispatch(fetchUsers());
    }
  }
}

export const eventUpdate = () => {
  return async (dispatch, getState) => {

    dispatch({ type: EVENT_FETCHING, payload: true});

    const eventFilter = getState().event.eventFilter;
    const query = { ...eventFilter,
      value: (eventFilter.value) ? eventFilter.value.split(',') : null,
      author: (eventFilter.author) ? eventFilter.author.split(',') : null,
      datasource: (eventFilter.datasource) ? eventFilter.datasource.split(',') : null
    }

    const payload = await get_events(query);

    dispatch({ type: UPDATE_EVENTS, payload });
    return dispatch({ type: EVENT_FETCHING, payload: false});
  };
}

export const eventUpdateCruiseReplay = () => {
  return async (dispatch, getState) => {

    dispatch({ type: EVENT_FETCHING, payload: true});

    const eventFilter = getState().event.eventFilter;
    const value = (eventFilter.value) ? eventFilter.value : (getState().event.hideASNAP) ? '!ASNAP' : null;
    const query = { ...eventFilter,
      value: (value) ? value.split(',') : null,
      author: (eventFilter.author) ? eventFilter.author.split(',') : null,
      datasource: (eventFilter.datasource) ? eventFilter.datasource.split(',') : null
    }

    const payload = await get_events(query);
    dispatch({ type: UPDATE_EVENTS, payload });

    const selected_event = (payload.length) ? await get_event_exports({}, payload[0].id) : {};
    dispatch({ type: SET_SELECTED_EVENT, payload: selected_event });
    return dispatch({ type: EVENT_FETCHING, payload: false});
  };
}

export const fetchCruises = () => {
  return async (dispatch) => {
    const payload = await get_cruises();
    return dispatch({type: FETCH_CRUISES, payload});
  }
}

export const fetchEvents = () => {
  return async (dispatch) => {
    const payload = await get_events();
    return dispatch({type: FETCH_EVENTS, payload});
  }
}

export const fetchEventTemplates = () => {
  return async (dispatch) => {
    const payload = await get_event_templates()
    return dispatch({type: FETCH_EVENT_TEMPLATES, payload});
  };
}

export const fetchEventTemplatesForMain = () => {

  const query = {
    sort: 'event_name'
  }

  return async (dispatch) => {
    const payload = await get_event_templates(query);
    return dispatch({ type: FETCH_EVENT_TEMPLATES_FOR_MAIN, payload })
  };
}

export const fetchFilteredEvents = (filterParams={}) => {

  const query = { ...filterParams,
    value: (filterParams.value) ? filterParams.value.split(',') : null,
    author: (filterParams.author) ? filterParams.author.split(',') : null,
    datasource: (filterParams.datasource) ? filterParams.datasource.split(',') : null
  }

  return async (dispatch) => {
    const payload = await get_events(query)
    return dispatch({type: FETCH_FILTERED_EVENTS, payload});
  };
}

export const fetchSelectedEvent = (id) => {
  return async (dispatch) => {
    const payload = await get_event_exports({}, id) || {};
    return dispatch({type: SET_SELECTED_EVENT, payload});
  }
}

export const fetchUsers = () => {
  return async (dispatch) => {
    const payload = await get_users();
    return dispatch({type: FETCH_USERS, payload});
  };
}

export const forgotPassword = ({email, reCaptcha = null}) => {

  const payload = (reCaptcha)? {email, resetURL, reCaptcha}: {email, resetURL};

  return async (dispatch) => {
    return await axios.post(`${API_ROOT_URL}/api/v1/auth/forgotPassword`, payload
      ).then(response => {
        return dispatch(authSuccess(response.data.message));
      }).catch((error)=>{
        console.debug(error);

        // If request is invalid
       return dispatch(authError(error.response.data.message));

      });
  };
}

export const gotoCruiseGallery = (id) => {
  return (dispatch) => {
    return dispatch(push(`/cruise_gallery/${id}`));
  };
}

export const gotoCruiseMap = (id) => {
  return (dispatch) => {
    return dispatch(push(`/cruise_map/${id}`));
  };
}

export const gotoCruiseMenu = () => {
  return (dispatch) => {
    return dispatch(push(`/cruise_menu`));
  };
}

export const gotoCruiseReplay = (id) => {
  return (dispatch) => {
    return dispatch(push(`/cruise_replay/${id}`));
  };
}

export const gotoCruiseReview = (id) => {
  return (dispatch) => {
    return dispatch(push(`/cruise_review/${id}`));
  };
}

export const gotoCruises = () => {
  return (dispatch) => {
    return dispatch(push(`/cruises`));
  };
}

export const gotoEventManagement = () => {
  return (dispatch) => {
    return dispatch(push(`/event_management`));
  };
}

export const gotoEventTemplates = () => {
  return (dispatch) => {
    return dispatch(push(`/event_templates`));
  };
}

export const gotoHome = () => {
  return (dispatch) => {
    return dispatch(push(`/`));
  };
}

export const gotoProfile = () => {
  return (dispatch) => {
    return dispatch(push(`/profile`));
  };
}

export const gotoTasks = () => {
  return (dispatch) => {
    return dispatch(push(`/tasks`));
  };
}

export const gotoUsers = () => {
  return (dispatch) => {
    return dispatch(push(`/users`));
  };
}

export const hideASNAP = () => {
  return (dispatch) => {
    return dispatch({type: HIDE_ASNAP});
  };
}

export const hideCruise = (id) => {

  let fields = { cruise_hidden: true };

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/cruises/${id}`, fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        return dispatch(fetchCruises());
      }).catch((error) => {
        console.debug(error);
        return dispatch(updateCruiseError(error.response.data.message));
      });
  };
}

export const initCruise = (id) => {
  return async (dispatch) => {
    const payload = await get_cruises({}, id) || {}
    return dispatch({ type: INIT_CRUISE, payload });
  };
}

export const initCruiseReplay = (id) => {
  return async (dispatch, getState) => {
    dispatch({ type: EVENT_FETCHING, payload: true});
    dispatch(initCruise(id));

    const eventFilter_value = (getState().event.eventFilter.value) ? getState().event.eventFilter.value : (getState().event.hideASNAP) ? '!ASNAP' : null;

    const query = { ...getState().event.eventFilter,
      value: (eventFilter_value) ? eventFilter_value.split(',') : null,
    }

    const payload = await get_events_by_cruise(query, id);
    dispatch({ type: INIT_EVENT, payload });

    if(payload.length) {
      dispatch(advanceCruiseReplayTo(payload[0].id));
    }

    return dispatch({ type: EVENT_FETCHING, payload: false});
  };
}

export const initEventTemplate = (id) => {
  return async (dispatch) => {

    const payload = await get_event_templates({}, id)
    return dispatch({ type: INIT_EVENT_TEMPLATE, payload })
  };
}

export const initUser = (id) => {
  return async (dispatch) => {
    const payload = await get_users({}, id)
    return dispatch({ type: INIT_USER, payload });
  };
}

export const leaveCruiseForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_CRUISE_FORM, payload: null});
  };
}

export const leaveEventFilterForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_EVENT_FILTER_FORM, payload: null});
  };
}

export const leaveEventTemplateForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_EVENT_TEMPLATE_FORM, payload: null});
  };
}

export const leaveLoginForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_AUTH_LOGIN_FORM, payload: null});
  };
}

export const leaveRegisterForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_REGISTER_USER_FORM, payload: null});
  };
}

export const leaveUpdateProfileForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_UPDATE_PROFILE_FORM, payload: null});
  };
}

export const leaveUserForm = () => {
  return (dispatch) => {
    return dispatch({type: LEAVE_USER_FORM, payload: null});
  };
}

export const login = ({username, password, reCaptcha = null}) => {

  const payload = (reCaptcha !== null)? {username, password, reCaptcha} : {username, password};

  return async (dispatch) => {
    return await axios.post(`${API_ROOT_URL}/api/v1/auth/login`, payload
      ).then(response => {
        // If request is good save the JWT token to a cookie
        cookies.set('token', response.data.token, { path: '/' });
        cookies.set('id', response.data.id, { path: '/' });

        dispatch({ type: AUTH_USER });
        return dispatch(updateProfileState());
      }).catch((error)=>{

        if(error.response && error.response.status !== 401) {
          // If request is unauthenticated
          return dispatch(authError(error.response.data.message));
        }
        else if(error.message == "Network Error") {
          return dispatch(authError("Unable to connect to server"));
        }

        return dispatch(authError(error.response.data.message));
      });
  };
}

export const logout = () => {
  return (dispatch) => {
    cookies.remove('token', { path: '/' });
    cookies.remove('id', { path: '/' });
    dispatch(push(`/login`));
    return dispatch({type: UNAUTH_USER });
  };
}

export const registerUser = ({username, fullname, password, email, reCaptcha = null}) => {

  const payload = (reCaptcha !== null)? {username, fullname, password, email, reCaptcha} : {username, fullname, password, email};

  return async (dispatch) => {
    return await axios.post(`${API_ROOT_URL}/api/v1/auth/register`, payload
      ).then(() => {
        return dispatch(registerUserSuccess('User created'));
      }).catch((error) => {

        console.debug(error);

        // If request is unauthenticated
        return dispatch(registerUserError(error.response.data.message));

      });
  };
}

export const registerUserError = (message) => {
  return {
    type: REGISTER_USER_ERROR,
    payload: message
  };
}

export const registerUserSuccess = (message) => {
  return {
    type: REGISTER_USER_SUCCESS,
    payload: message
  };
}

export const resetFields = (formName, fieldsObj) => {
  return (dispatch) => {
    Object.keys(fieldsObj).forEach(fieldKey => {
      //reset the field's value
      dispatch(change(formName, fieldKey, fieldsObj[fieldKey]));

      //reset the field's error
      return dispatch(untouch(formName, fieldKey));
    });
  };
}

export const resetPassword = ({token, password, reCaptcha = null}) => {

  const payload = (reCaptcha)? {token, password, reCaptcha}: {token, password};

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/auth/resetPassword`, payload
      ).then(() => {
        return dispatch(authSuccess('Password Reset'));
      }).catch((error) => {

        console.debug(error);

        // If request is unauthenticated
        return dispatch(authError(error.response.data.message));

      });
  };
}

export const showASNAP = () => {
  return (dispatch) => {
    return dispatch({type: SHOW_ASNAP});
  };
}

export const showCruise = (id) => {

  let fields = { cruise_hidden: false };

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/cruises/${id}`, fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        return dispatch(fetchCruises());
      }).catch((error) => {
        console.debug(error);
        return dispatch(updateCruiseError(error.response.data.message));
      });
  };
}

export const showModal = (modal, props) => {
  return (dispatch) => {
    return dispatch(show(modal, props));
  };
}

export const switch2Guest = (reCaptcha = null) => {
  return (dispatch) => {
    return dispatch(login( { username:"guest", password: "", reCaptcha } ) );
  };
}

export const updateCruise = (formProps) => {

  let fields = { ...formProps};
  delete fields.id;

  return async (dispatch) => {
    const response = await update_cruise(fields, formProps.id);
    if(response.success) {
      dispatch(fetchCruises());
      return dispatch(updateCruiseSuccess('Cruise updated'));
    }
    else {
      return dispatch(updateCruiseError(response.error.response.data.message));
    }
  };
}

export const updateCruiseError = (message) => {
  return {
    type: UPDATE_CRUISE_ERROR,
    payload: message
  };
}

export const updateCruiseReplayEvent = (id) => {
  return async (dispatch) => {
    const payload = await get_events({}, id);
    return dispatch({type: UPDATE_EVENT, payload});
  };
}

export const updateCruiseSuccess = (message) => {
  return {
    type: UPDATE_CRUISE_SUCCESS,
    payload: message
  };
}

export const updateEvent = (formProps) => {

  return async (dispatch) => {
    const response = await updateEventRequest(formProps);
    if(response.success) {
      return dispatch({ type: UPDATE_EVENT, payload: formProps });
    }
  }
}

export const updateEventFilterForm = (formProps) => {
  return (dispatch) => {
    return dispatch({type: UPDATE_EVENT_FILTER_FORM, payload: formProps});
  };
}

export const updateEventRequest = async (formProps) => {

  let fields = { ...formProps }
  delete fields.id
  return await update_event(fields, formProps.id);
}

export const updateEventTemplate = (formProps) => {

  let fields = { ...formProps };
  delete fields.id;

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/event_templates/${formProps.id}`,
      fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        dispatch(fetchEventTemplates());
        return dispatch(updateEventTemplateSuccess('Event template updated'));
      }).catch((error) => {
        console.debug(error);

        // If request is unauthenticated
        return dispatch(updateEventTemplateError(error.response.data.message));
      });
  };
}

export const updateEventTemplateCategory = (category) => {
  return { type: UPDATE_EVENT_TEMPLATE_CATEGORY, payload: category };
}

export const updateEventTemplateError = (message) => {
  return {
    type: UPDATE_EVENT_TEMPLATE_ERROR,
    payload: message
  };
}

export const updateEventTemplateSuccess = (message) => {
  return {
    type: UPDATE_EVENT_TEMPLATE_SUCCESS,
    payload: message
  };
}

export const updateProfile = (formProps) => {

  let fields = {};

  if(formProps.username) {
    fields.username = formProps.username;
  }

  if(formProps.fullname) {
    fields.fullname = formProps.fullname;
  }

  if(formProps.password) {
    fields.password = formProps.password;
  }

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/users/${formProps.id}`,
      fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        dispatch(updateProfileState());
        return dispatch(updateProfileSuccess('User updated'));
      }).catch((error) => {
        console.debug(error);

        // If request is unauthenticated
        return dispatch(updateProfileError(error.response.data.message));
      });
  };
}

export const updateProfileError = (message) => {
  return {
    type: UPDATE_PROFILE_ERROR,
    payload: message
  };
}

export const updateProfileState = () => {

  return async (dispatch) => {
    return await axios.get(`${API_ROOT_URL}/api/v1/auth/profile`,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then((response) => {
        return dispatch({ type: UPDATE_PROFILE, payload: response.data });
      }).catch((error)=>{
        console.debug(error);
      });
  };
}

export const updateProfileSuccess = (message) => {
  return {
    type: UPDATE_PROFILE_SUCCESS,
    payload: message
  };
}

export const updateUser = (formProps) => {

  let fields = { ...formProps};
  delete fields.id;

  return async (dispatch) => {
    return await axios.patch(`${API_ROOT_URL}/api/v1/users/${formProps.id}`,
      fields,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        dispatch(fetchUsers());
        return dispatch(updateUserSuccess('User updated'));
      }).catch((error) => {
        console.debug(error);

        // If request is unauthenticated
        return dispatch(updateUserError(error.response.data.message));
      });
  };
}

export const updateUserError = (message) => {
  return {
    type: UPDATE_USER_ERROR,
    payload: message
  };
}

export const updateUserSuccess = (message) => {
  return {
    type: UPDATE_USER_SUCCESS,
    payload: message
  };
}

export const validateJWT = () => {

  const token = cookies.get('token');

  if(!token) {
    return (dispatch) => {
      dispatch({type: UNAUTH_USER});
    };
  }

  return async (dispatch) => {
    return await axios.get(`${API_ROOT_URL}/api/v1/auth/validate`,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then(() => {
        return dispatch({type: AUTH_USER});
      }).catch(()=>{
        return dispatch(logout());
      });
  };
}
