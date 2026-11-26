'use client';

import { useMemo } from 'react';
import QRCode from 'qrcode';

interface LygaQrCodeProps {
  value: string;
  size?: number;
}

function isFinderZone(r: number, c: number, n: number): boolean {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= n - 7) return true;
  if (r >= n - 7 && c < 7) return true;
  return false;
}

export function LygaQrCode({ value, size = 196 }: LygaQrCodeProps) {
  const model = useMemo(() => {
    if (!value) return null;
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const n = qr.modules.size;
    const halfCut = Math.max(3, Math.floor(n * 0.1));
    const cutMin = Math.floor(n / 2) - halfCut;
    const cutMax = Math.ceil(n / 2) + halfCut - 1;

    const isCutout = (r: number, c: number) =>
      r >= cutMin && r <= cutMax && c >= cutMin && c <= cutMax;

    const isDataActive = (r: number, c: number) =>
      r >= 0 &&
      c >= 0 &&
      r < n &&
      c < n &&
      !isFinderZone(r, c, n) &&
      !isCutout(r, c) &&
      Boolean(qr.modules.get(r, c));

    const rects: Array<{
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rx: number;
      fill: string;
    }> = [];

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (!isDataActive(r, c)) continue;

        const right = isDataActive(r, c + 1);
        const down = isDataActive(r + 1, c);
        const left = isDataActive(r, c - 1);
        const up = isDataActive(r - 1, c);
        const isolated = !right && !down && !left && !up;
        const fill =
          isolated && (r < 5 || r > n - 6 || c < 5 || c > n - 6) ? '#14b8a6' : '#0e4e49';

        rects.push({
          key: `m-${r}-${c}`,
          x: c + 0.08,
          y: r + 0.08,
          w: 0.84,
          h: 0.84,
          rx: 0.42,
          fill,
        });

        if (right) {
          rects.push({
            key: `h-${r}-${c}`,
            x: c + 0.5,
            y: r + 0.08,
            w: 1,
            h: 0.84,
            rx: 0,
            fill,
          });
        }

        if (down) {
          rects.push({
            key: `v-${r}-${c}`,
            x: c + 0.08,
            y: r + 0.5,
            w: 0.84,
            h: 1,
            rx: 0,
            fill,
          });
        }
      }
    }

    return { n, cutMin, cutMax, rects };
  }, [value]);

  if (!model) {
    return <div style={{ width: size, height: size }} />;
  }

  const { n, cutMin, cutMax, rects } = model;
  const pad = 1.5;
  const vbMin = -pad;
  const vbSpan = n + pad * 2;

  const badgeSize = cutMax - cutMin + 1 - 0.5;
  const badgeXY = n / 2 - badgeSize / 2;
  const badgeRadius = badgeSize * 0.28;

  const finders: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];

  const logoScale = (badgeSize * 0.6) / 160;
  const logoTx = n / 2 - 128 * logoScale;
  const logoTy = n / 2 - 137 * logoScale;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${vbMin} ${vbMin} ${vbSpan} ${vbSpan}`}
      role="img"
      aria-label="Pair phone QR code"
      shapeRendering="geometricPrecision"
    >
      <rect x={vbMin} y={vbMin} width={vbSpan} height={vbSpan} fill="#ffffff" />

      {finders.map(([fx, fy]) => (
        <g key={`finder-${fx}-${fy}`}>
          <rect
            x={fx + 0.5}
            y={fy + 0.5}
            width={6}
            height={6}
            rx={1.7}
            fill="none"
            stroke="#072b28"
            strokeWidth={1}
          />
          <rect x={fx + 2} y={fy + 2} width={3} height={3} rx={0.9} fill="#072b28" />
        </g>
      ))}

      {rects.map((el) => (
        <rect
          key={el.key}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          rx={el.rx}
          fill={el.fill}
        />
      ))}

      <rect
        x={badgeXY}
        y={badgeXY}
        width={badgeSize}
        height={badgeSize}
        rx={badgeRadius}
        fill="#ffffff"
        stroke="#ccfbf1"
        strokeWidth={0.35}
      />
      <g transform={`translate(${logoTx}, ${logoTy}) scale(${logoScale})`}>
        <path
          d="M64 94L92 66v116h100l-28 28"
          fill="none"
          stroke="#115e59"
          strokeWidth={28}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
