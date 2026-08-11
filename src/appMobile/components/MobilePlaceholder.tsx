import React from 'react'

interface MobilePlaceholderProps {
  title: string
}

export default function MobilePlaceholder({ title }: MobilePlaceholderProps) {
  return <div>{title}</div>
}
