import type { LevelKey } from '../../lib/api'
import { LEVEL_STYLE, fmtNum } from './ui'

export default function LevelBadge({ level, score }: { level: LevelKey; score?: number }) {
  const s = LEVEL_STYLE[level]
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset ${s.badge}`}>
      {s.label}
      {score !== undefined && <> · {fmtNum(score)}</>}
    </span>
  )
}
