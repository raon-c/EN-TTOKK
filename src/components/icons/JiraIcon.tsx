import type { SVGProps } from "react";

export function JiraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <title>Jira</title>
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84h-9.63Z" />
      <path d="M6.77 6.8a4.36 4.36 0 0 0 4.34 4.38h1.8v1.7c0 2.4 1.93 4.35 4.33 4.37V7.63a.84.84 0 0 0-.83-.83H6.77Z" />
      <path d="M2 11.6c0 2.4 1.95 4.34 4.35 4.36h1.78v1.72c0 2.4 1.95 4.35 4.35 4.32v-9.57a.84.84 0 0 0-.84-.83H2Z" />
    </svg>
  );
}
