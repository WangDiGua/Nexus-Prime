import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/svg+xml';

/** 与 `NexusLogo` / 暗色侧栏一致：主色星形 + 虚线环（非独立蓝色） */
const BG = '#212121';
const STAR = '#ececec';
const RING = 'rgba(236, 236, 236, 0.45)';

export default function Icon() {
  return new ImageResponse(
    (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="32" height="32">
        <rect width="50" height="50" rx="11" fill={BG} />
        <circle cx="25" cy="25" r="22" fill="none" stroke={RING} strokeWidth="2" strokeDasharray="4 4" />
        <path d="M25,5 Q25,25 45,25 Q25,25 25,45 Q25,25 5,25 Q25,25 25,5 Z" fill={STAR} />
      </svg>
    ),
    { ...size }
  );
}
