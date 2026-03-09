import http from '@/api/http'

export async function getUsers() {
  const response = await http.get('/api/users')
  return response.data
}

export async function deleteUser(userId, requesterUserId) {
  await http.delete(`/api/users/${userId}`, {
    data: {
      requesterUserId,
    },
    headers: {
      'X-Requester-User-Id': requesterUserId,
    },
    params: {
      requesterUserId,
    },
  })
}
