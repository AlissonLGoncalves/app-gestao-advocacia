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

/**
 * Solicita link de redefinição de senha. A resposta é sempre genérica para
 * não vazar quais emails existem na base.
 * @param {{email: string}} payload
 */
export function forgotPassword(payload) {
  return api.post('/auth/forgot-password', payload, { auth: false })
}

/**
 * Confirma a redefinição de senha com o token recebido por email.
 * @param {{token: string, password: string}} payload
 */
export function resetPassword(payload) {
  return api.post('/auth/reset-password', payload, { auth: false })
}
