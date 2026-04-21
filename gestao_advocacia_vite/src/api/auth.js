import { api } from './client'

/**
 * @param {{username_or_email: string, password: string}} payload
 */
export function login(payload) {
  return api.post('/auth/login', payload)
}

/**
 * @param {object} payload
 */
export function register(payload) {
  return api.post('/auth/register', payload)
}

/**
 * @param {object} payload
 */
export function registerInvite(payload) {
  return api.post('/auth/register-invite', payload)
}

export function me() {
  return api.get('/auth/me')
}

export function consentimentos() {
  return api.get('/auth/me/consentimentos')
}
