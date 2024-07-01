import Cookies from 'universal-cookie'
import { ROOT_PATH } from './client_config'

const cookies = new Cookies(null, { path: ROOT_PATH, sameSite: 'none', secure: true })

export default cookies
