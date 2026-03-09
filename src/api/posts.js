import http from '@/api/http'

export async function getPosts() {
  const response = await http.get('/api/posts')
  return response.data
}

export async function getPost(postNo) {
  const response = await http.get(`/api/posts/${postNo}`)
  return response.data
}

export async function createPost(payload) {
  const response = await http.post('/api/posts', payload)
  return response.data
}

export async function deletePost(postNo, requesterUserId) {
  await http.delete(`/api/posts/${postNo}`, {
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
