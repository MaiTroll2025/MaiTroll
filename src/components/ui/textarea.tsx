import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  children?: React.ReactNode
  label?: string
  minRows?: number
}

export const Textarea = ({ minRows, ...props }: TextareaProps) => {
  return <textarea rows={props.rows ?? minRows} {...props} />
}
