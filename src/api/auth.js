import http from '@/api/http'

export async function loginUser(payload) {
  const response = await http.post('/api/users/login', payload)
  return response.data
}

export async function signUpUser(payload) {
  const response = await http.post('/api/users/signup', payload)
  return response.data
}
