import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode
}

export const Input = (props: InputProps) => {
  return <input {...props} />
}
