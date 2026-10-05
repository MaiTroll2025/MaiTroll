import { Link } from 'react-router-dom'

export default function HashtagCaption({ text }: { text: string }) {
  const parts = text.split(/(#[A-Za-z0-9_]+)/g)

  return (
    <>
      {parts.map((part, index) => part.startsWith('#') ? (
        <Link
          key={`${part}-${index}`}
          to={`/explore?q=${encodeURIComponent(part)}&tab=posts`}
          className="font-semibold text-cyan-300 hover:text-cyan-200"
        >
          {part}
        </Link>
      ) : part)}
    </>
  )
}