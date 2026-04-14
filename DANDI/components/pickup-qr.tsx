"use client";

type PickupQrProps = {
  value: string;
  size?: number;
};

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isFinderPattern(x: number, y: number, n: number) {
  const inTopLeft = x < 7 && y < 7;
  const inTopRight = x >= n - 7 && y < 7;
  const inBottomLeft = x < 7 && y >= n - 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function finderCell(x: number, y: number, n: number) {
  let fx = x;
  let fy = y;
  if (x >= n - 7 && y < 7) {
    fx = x - (n - 7);
  } else if (x < 7 && y >= n - 7) {
    fy = y - (n - 7);
  }

  const edge = fx === 0 || fx === 6 || fy === 0 || fy === 6;
  const center = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
  return edge || center;
}

export function PickupQr({ value, size = 144 }: PickupQrProps) {
  const n = 21;
  const cells: boolean[] = [];
  const seed = hashString(value);

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (isFinderPattern(x, y, n)) {
        cells.push(finderCell(x, y, n));
        continue;
      }
      const v = (seed + x * 92821 + y * 68917 + x * y * 271) % 11;
      cells.push(v % 2 === 0);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-2" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
          gap: 0,
        }}
        aria-label={`QR-${value}`}
      >
        {cells.map((on, idx) => (
          <span key={idx} className={on ? "bg-black" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}
