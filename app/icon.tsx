import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/svg+xml';

export default function Icon() {
  return new ImageResponse(
    (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="32" height="32">
        <circle cx="25" cy="25" r="22" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M25,5 Q25,25 45,25 Q25,25 25,45 Q25,25 5,25 Q25,25 25,5 Z" fill="#2563eb" />
      </svg>
    ),
    { ...size }
  );
}
