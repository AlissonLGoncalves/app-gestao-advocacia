import { api } from './client'

export const getTenant = () => api.get('/tenant/')

export const updateTenant = (dados) => api.put('/tenant/', dados)
