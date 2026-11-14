import { request } from '@/api/client'
import type { Page } from '@/types'

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
  /** 精确作者 id：列表页「我的」开关用它，不和模糊作者搜索混用 */
  authorId?: number
}

export interface PostNeighborRef {
  id: number
  title: string
}

/** 上一篇 / 下一篇：prev 是列表里更靠前（更新）的一篇，next 是更早的一篇。
 * 不再返回「在第几篇」——返回列表靠 router state 记住来源页，不需要服务端 COUNT。 */
export interface PostNeighbors {
  prev: PostNeighborRef | null
  next: PostNeighborRef | null
}

/** 列表统一形状：服务端多取一条判断 has_next，客户端不再自己请求 limit+1 */
export type PostPage = Page<Post>

/** 带筛选参数的分页 / 相邻查询共用的参数构造 */
function postFilterParams(filters: PostFilters): URLSearchParams {
  const params = new URLSearchParams()
  const q = filters.q?.trim()
  if (q) params.set('q', q)
  const author = filters.author?.trim()
  if (author) params.set('author', author)
  if (filters.authorId !== undefined) params.set('author_id', String(filters.authorId))
  return params
}

/** 需要登录的写操作：统一走 withAuth=true */
function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true)
}

export const blogApi = {
  /** 传入选中的筛选条件，相邻文章就按同一份筛选结果排序；当前文章不在结果里时两者都为 null */
  getNeighbors(postId: number, filters: PostFilters = {}): Promise<PostNeighbors> {
    const query = postFilterParams(filters).toString()
    return request<PostNeighbors>(`/posts/${postId}/neighbors${query ? `?${query}` : ''}`)
  },
  listPosts(limit: number, offset: number, filters: PostFilters = {}): Promise<PostPage> {
    const params = postFilterParams(filters)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return request<PostPage>(`/posts?${params.toString()}`)
  },
  getPost(id: number): Promise<Post> {
    return request<Post>(`/posts/${id}`)
  },
  createPost(payload: CreatePostPayload): Promise<Post> {
    return authRequest<Post>('/posts', { method: 'POST', body: JSON.stringify(payload) })
  },
  updatePost(id: number, payload: UpdatePostPayload): Promise<Post> {
    return authRequest<Post>(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deletePost(id: number): Promise<unknown> {
    return authRequest<unknown>(`/posts/${id}`, { method: 'DELETE' })
  },
  /** 批量删除：单次请求，后端逐条返回成败，不做整体回滚 */
  deletePostsBatch(ids: number[]): Promise<BatchDeleteResult> {
    return authRequest<BatchDeleteResult>('/posts/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  listComments(postId: number): Promise<Comment[]> {
    return request<Comment[]>(`/posts/${postId}/comments`)
  },
  createComment(postId: number, body: string, parentId?: number): Promise<Comment> {
    const payload = parentId === undefined ? { body } : { body, parent_id: parentId }
    return authRequest<Comment>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  deleteComment(id: number): Promise<{ id: number; deleted_comments: number }> {
    return authRequest<{ id: number; deleted_comments: number }>(`/comments/${id}`, {
      method: 'DELETE',
    })
  },
}
