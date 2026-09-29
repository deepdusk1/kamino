import type { ReactNode } from "react";

// A small, deliberately limited formatting vocabulary. React escapes all text;
// raw HTML and executable URL schemes never become markup.
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*\n]+\*\*|_[^_\n]+_|~~[^~\n]+~~|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.startsWith("~~") && part.endsWith("~~")) return <s key={i}>{part.slice(2, -2)}</s>;
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link)
        return (
          <a
            key={i}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            {link[1]}
          </a>
        );
      return part;
    });
}
export function FormattedBody({ body, formatted = false }: { body: string; formatted?: boolean }) {
  if (!formatted)
    return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{body}</p>;
  return (
    <div className="space-y-2 break-words text-sm leading-relaxed">
      {body.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return (
            <h3 key={i} className="pt-3 text-xl font-bold">
              {inline(line.slice(3))}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={i} className="pt-3 text-2xl font-bold">
              {inline(line.slice(2))}
            </h2>
          );
        if (line.startsWith("> "))
          return (
            <blockquote key={i} className="border-l-2 border-accent pl-3 text-muted">
              {inline(line.slice(2))}
            </blockquote>
          );
        if (line.startsWith("- "))
          return (
            <ul key={i} className="list-disc pl-5">
              <li>{inline(line.slice(2))}</li>
            </ul>
          );
        return (
          <p key={i} className="min-h-3 whitespace-pre-wrap">
            {inline(line)}
          </p>
        );
      })}
    </div>
  );
}
