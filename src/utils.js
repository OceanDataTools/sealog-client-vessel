import path from 'path';
import { API_ROOT_URL, ROOT_PATH, IMAGE_PATH, CUSTOM_CRUISE_NAME } from './client_config';

// This function constructs a URL to an image served by the Sealog server.
// Normally, this should correspond to the server's IMAGE_ROUTE setting
// (defined in routes/default.js).
//
// Override this function to serve images through alternate methods, such as a
// caching proxy.
//
// Credit rgov (WHOIGit/ndsf-sealog-client)
export function getImageUrl(image_path) {
  return API_ROOT_URL + IMAGE_PATH + path.basename(image_path);
}

export function handleMissingImage(ev) {
  ev.target.src = `${window.location.protocol}//${window.location.hostname}:${window.location.port}${ROOT_PATH}images/noimage.jpeg`;
}

function toTitlecase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const [ _cruise_, _cruises_ ] =
  CUSTOM_CRUISE_NAME || ["expedition", "expeditions"];

export const [ _Cruise_, _Cruises_ ] =
  [ toTitlecase(_cruise_), toTitlecase(_cruises_) ];
