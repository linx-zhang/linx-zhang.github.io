import { useState } from 'react'
import { displayName, initialOf } from './avatarText'
import type { AvatarUser } from './avatarText'
import './Avatar.css'

export interface AvatarProps {
  user?: AvatarUser | null
  /** 覆盖显示名，用于只有 author_name 的评论 */
  name?: string | null
  /** 覆盖头像地址 */
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  title?: string
}

/** 有 avatar_url 时显示图片（加载失败回退首字母），否则显示首字母 */
export default function Avatar({
  user,
  name,
  avatarUrl,
  size = 'md',
  className,
  title,
}: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const url = avatarUrl ?? user?.avatar_url ?? null
  const label = name?.trim() || displayName(user)
  const initial = initialOf(label)
  const showImage = Boolean(url) && failedUrl !== url

  return (
    <span
      className={className ? `avatar avatar-${size} ${className}` : `avatar avatar-${size}`}
      title={title ?? (label || undefined)}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          className="avatar-image"
          src={url ?? ''}
          alt=""
          loading="lazy"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        initial
      )}
    </span>
  )
}
