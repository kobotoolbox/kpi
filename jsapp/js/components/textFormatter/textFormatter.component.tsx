import type {ReactNode} from 'react';

const regExpMatchParts = /[^*[\]]+|(\*\*[^*]*(?:\*[^*]+)*\*\*)|(\*[^*]+\*)|(\[.+?\]\(.+?\)({:.+})?)/g;

const processText = (text: string): ReactNode[] => {
  const parts = text.match(regExpMatchParts);

  if (!parts) {return [text];}

  const formattedParts: ReactNode[] = [];

  for (const part of parts) {
    if (part.startsWith('**')) {
      formattedParts.push(<strong>{processText(part.slice(2, -2))}</strong>);
    } else if (part.startsWith('*')) {
      formattedParts.push(<em>{processText(part.slice(1, -1))}</em>);
    } else if (part.startsWith('[')) {
      const [label, link, target] = part
        .slice(1, -1)
        .split(/\]\(|\)\{:target=/);
      formattedParts.push(
        <a href={link} target={target ? target.slice(1, -1) : '_self'}>
          {processText(label)}
        </a>
      );
    } else {
      formattedParts.push(part);
    }
  }

  return formattedParts;
};

interface TextFormatterProps {
  /**
   * Text will be processed and formatted with markdown-like syntax. It accepts the following:
   * - *<text>* for italic
   * - **<text>** for bold
   * - [text](link) for links with target _self
   * - [text](link){:target="_blank"} for links with target _blank or other target
   * - Formatting can be nested to be combined
   */
  text: string;
}

/**
 * This component process text and applies simple formatting rules with markdown-like syntax.
 * This is meant to be used with long sentences that need formatting and cannot be broken down
 * into smaller components duo to translation issues that broken down components would cause.
 * The formatting options mimics markdown syntax for italic, bold and links.
 *
 * @returns ReactNode[]
 */
export default function TextFormatter({text}: TextFormatterProps) {
  return processText(text);
}
