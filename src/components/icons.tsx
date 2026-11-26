import type { SVGProps } from 'react';

export const EthIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2l6 10-6 10-6-10z" />
    <path d="M12 2v10" />
    <path d="M12 12l6 10" />
    <path d="M12 12l-6 10" />
    <path d="M18 12L6 12" />
  </svg>
);

export const AppleIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
      <path d="M10 2c1 .5 2 2 2 5" />
    </svg>
  );

export const PlayStoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor"
    {...props}
  >
    <path d="M3.1,2.5l9.9,9.9l-9.9,9.9C1.6,20.8,1.6,18,3.1,2.5z M14.5,12.4L4.6,2.5C6.1,1,8.9,1,14.5,12.4z M14.5,12.4L4.6,22.3C6.1,23.8,8.9,23.8,14.5,12.4z M16,16.8l4.9-2.9c1.5-1.5,1.5-2.9,0-4.4L16,6.7V16.8z"/>
  </svg>
);
