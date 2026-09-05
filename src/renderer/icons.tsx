import type { SVGProps } from 'react';

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const InboxIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 3h6v3H9zM8 13l3 3 5-6"/></IconBase>;
export const ArchiveIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><path d="M5 8v10q0 3 3 3h8q3 0 3-3V8"/><rect x="3" y="3" width="18" height="5" rx="1.5"/><path d="M9 12q3 3 6 0"/></IconBase>;
export const SunIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/></IconBase>;
export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></IconBase>;
export const TrashIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></IconBase>;
export const RestoreIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><path d="M4 9V4h5"/><path d="M5.5 6.5A8 8 0 1 1 4 14"/></IconBase>;
export const CloseIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18"/></IconBase>;
export const ImageIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></IconBase>;
export const CheckIcon = (props: SVGProps<SVGSVGElement>) => <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>;
