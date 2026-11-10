import { request } from '@/api/auth'

export interface Post {
  id: number
  author_id: number
  author_name: string | null
  title: string
  body_md: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: number
  post_id: number
  author_id: number
  author_name: string | null
  parent_id: number | null
  body: string
  created_at: string
}

export interface CreatePostPayload {
  title: string
  body_md: string
}

export interface UpdatePostPayload {
  title?: string
  body_md?: string
}

export const blogApi = {
  listPosts(limit: number, offset: number): Promise<Post[]> {
    return request<Post[]>(`/posts?limit=${limit}&offset=${offset}`)
  },
  getPost(id: number): Promise<Post> {
    return request<Post>(`/posts/${id}`)
  },
  createPost(payload: CreatePostPayload): Promise<Post> {
    return request<Post>(
      '/posts',
      { method: 'POST', body: JSON.stringify(payload) },
      true,
      { skipForbiddenLogout: true },
    )
  },
  updatePost(id: number, payload: UpdatePostPayload): Promise<Post> {
    return request<Post>(
      `/posts/${id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
      { skipForbiddenLogout: true },
    )
  },
  deletePost(id: number): Promise<unknown> {
    return request<unknown>(
      `/posts/${id}`,
      { method: 'DELETE' },
      true,
      { skipForbiddenLogout: true },
    )
  },
  listComments(postId: number): Promise<Comment[]> {
    return request<Comment[]>(`/posts/${postId}/comments`)
  },
  createComment(postId: number, body: string, parentId?: number): Promise<Comment> {
    const payload = parentId === undefined ? { body } : { body, parent_id: parentId }
    return request<Comment>(
      `/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify(payload) },
      true,
    )
  },
  deleteComment(id: number): Promise<{ id: number; deleted_comments: number }> {
    return request<{ id: number; deleted_comments: number }>(
      `/comments/${id}`,
      { method: 'DELETE' },
      true,
      { skipForbiddenLogout: true },
    )
  },
}
