import { request } from '@/api/client'

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

export interface BatchDeleteFailure {
  id: number
  code: string
  detail: string
}

export interface BatchDeleteResult {
  deleted: number[]
  failed: BatchDeleteFailure[]
}

export interface PostFilters {
  /** 标题模糊搜索 */
  q?: string
  /** 作者模糊搜索：邮箱、昵称或「名 姓」 */
  author?: string
}

export interface PostNeighborRef {
  id: number
  title: string
}

/** 上一篇 / 下一篇：prev 是列表里更靠前（更新）的一篇，next 是更早的一篇 */
export interface PostNeighbors {
  /** 这篇文章在列表中的位置（0 基）；有筛选条件时为 null（不为此再做一次 COUNT） */
  index: number | null
  prev: PostNeighborRef | null
  next: PostNeighborRef | null
}

export const blogApi = {
  /** 传入选中的筛选条件，相邻文章就按同一份筛选结果排序；当前文章不在结果里时两者都为 null */
  getNeighbors(postId: number, filters: PostFilters = {}): Promise<PostNeighbors> {
    const params = new URLSearchParams()
    const q = filters.q?.trim()
    if (q) params.set('q', q)
    const author = filters.author?.trim()
    if (author) params.set('author', author)
    const query = params.toString()
    return request<PostNeighbors>(`/posts/${postId}/neighbors${query ? `?${query}` : ''}`)
  },
  listPosts(limit: number, offset: number, filters: PostFilters = {}): Promise<Post[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    const q = filters.q?.trim()
    if (q) params.set('q', q)
    const author = filters.author?.trim()
    if (author) params.set('author', author)
    return request<Post[]>(`/posts?${params.toString()}`)
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
  /** 批量删除：单次请求，后端逐条返回成败，不做整体回滚 */
  deletePostsBatch(ids: number[]): Promise<BatchDeleteResult> {
    return request<BatchDeleteResult>(
      '/posts/batch-delete',
      { method: 'POST', body: JSON.stringify({ ids }) },
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
