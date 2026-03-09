import axios from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message ?? fallbackMessage
}

export default http
