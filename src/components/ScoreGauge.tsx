const R = 48
const CX = 60
const CY = 60

const point = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)] as const
}

const arcPath = (fromDeg: number, toDeg: number, radius: number) => {
  const [x1, y1] = point(fromDeg, radius)
  const [x2, y2] = point(toDeg, radius)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`
}

/** A half-circle "credit score" style gauge: red/amber/green bands and a needle at the value. */
export function ScoreGauge({ value, max = 5 }: { value: number; max?: number }) {
  const angleOf = (v: number) => 180 * (1 - Math.min(Math.max(v, 0), max) / max)
  const bandEdges: [number, number, string][] = [
    [0, max * 0.7, 'var(--bad)'],
    [max * 0.7, max * 0.9, 'var(--warn)'],
    [max * 0.9, max, 'var(--ok)'],
  ]
  const needleAngle = angleOf(value)
  const needleTip = point(needleAngle, R - 10)

  return (
    <svg width={120} height={84} viewBox="0 0 120 84" role="img" aria-label={`Score ${value.toFixed(2)} of ${max}`}>
      {bandEdges.map(([from, to, color]) => (
        <path
          key={color}
          d={arcPath(angleOf(from), angleOf(to), R)}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
        />
      ))}
      <line
        x1={CX}
        y1={CY}
        x2={needleTip[0]}
        y2={needleTip[1]}
        stroke="var(--ink)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={4} fill="var(--ink)" />
      <text x={CX} y={CY + 20} textAnchor="middle" fontSize="18" fontWeight={700} fill="var(--ink)">
        {value.toFixed(2)}
      </text>
    </svg>
  )
}
