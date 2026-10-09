import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode
  label?: string
}

export const Input = (props: InputProps) => {
  return <input {...props} />
}
