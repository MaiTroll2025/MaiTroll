import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  children?: React.ReactNode
}

export const Textarea = (props: TextareaProps) => {
  return <textarea {...props} />
}
