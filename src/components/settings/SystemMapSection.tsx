import React, { useMemo, useState } from 'react'
import type { ConsumerInfo, ExtensionInfo, HarnessMap, PluginInfo, ServiceInfo } from '../../harness/describe'
import { describeHarness } from '../../harness/describe'
import { tint } from '../../theme/themes'
import type { ThemeConfig } from '../../types'
import type { TFunc } from './ui'

/**
 * 系统 section — a live topology map of the harness: the cordis core holding
 * the service registry, the builtin plugins around it, their consumers, and
 * the planned extension slots (dashed). Click any node for details.
 */

type Selection =
  | { type: 'core' }
  | { type: 'service'; item: ServiceInfo }
  | { type: 'plugin'; item: PluginInfo }
  | { type: 'consumer'; item: ConsumerInfo }
  | { type: 'extension'; item: ExtensionInfo }

const W = 920
const H = 640

const SystemMapSection: React.FC<{ theme: ThemeConfig; t: TFunc }> = ({ theme, t }) => {
  const map: HarnessMap = useMemo(() => describeHarness(), [])
  const [sel, setSel] = useState<Selection | null>(null)

  const liveColor = theme.success
  const deadColor = theme.danger
  const nodeFill = tint(theme.text, theme.card, 0.04)
  const extNodeFill = 'transparent'

  // Geometry -----------------------------------------------------------------
  const serviceBox = { x: 352, y: 236, w: 216, h: 148 }
  const serviceChip = (i: number) => ({ x: serviceBox.x + 12, y: serviceBox.y + 34 + i * 34, w: serviceBox.w - 24, h: 26 })

  const pluginPos = (i: number) => ({ x: 700, y: 66 + i * 76, w: 190, h: 56 })
  const consumerPos = (i: number) => ({ x: 30, y: 58 + i * 84, w: 190, h: 56 })
  const extPos = (i: number) => ({ x: 60 + i * 208, y: 540, w: 190, h: 56 })

  const serviceByKey = (key: string) => map.services.find(s => s.key === key)
  const serviceCenter = (key: string) => {
    const i = map.services.findIndex(s => s.key === key)
    const c = serviceChip(i)
    return { x: c.x + c.w, y: c.y + c.h / 2 }
  }
  const serviceLeft = (key: string) => {
    const i = map.services.findIndex(s => s.key === key)
    const c = serviceChip(i)
    return { x: c.x, y: c.y + c.h / 2 }
  }

  const line = (x1: number, y1: number, x2: number, y2: number, opts: { dashed?: boolean; color?: string } = {}) => (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={opts.color || theme.hairline}
      strokeWidth={1.4}
      strokeDasharray={opts.dashed ? '4 4' : undefined}
      markerEnd={opts.dashed ? 'url(#arrowDim)' : 'url(#arrow)'}
      opacity={0.9}
    />
  )

  const node = (
    pos: { x: number; y: number; w: number; h: number },
    selected: boolean,
    onClick: () => void,
    content: React.ReactNode,
    opts: { dashed?: boolean; fill?: string } = {},
  ) => (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx={10}
        fill={opts.fill ?? nodeFill}
        stroke={selected ? theme.primary : opts.dashed ? theme.hairline : tint(theme.text, theme.card, 0.16)}
        strokeWidth={selected ? 2 : 1.2}
        strokeDasharray={opts.dashed ? '5 4' : undefined}
      />
      {content}
    </g>
  )

  const dot = (cx: number, cy: number, live: boolean) => (
    <circle cx={cx} cy={cy} r={4} fill={live ? liveColor : deadColor} />
  )

  const labelText = (x: number, y: number, text: string, size: number, color: string, weight = 500, anchor: 'start' | 'middle' | 'end' = 'start') => (
    <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight} textAnchor={anchor} dominantBaseline="middle">
      {text}
    </text>
  )

  // Selection detail ---------------------------------------------------------
  const detail = (() => {
    if (!sel) return null
    if (sel.type === 'core') {
      return { title: map.core.name, lines: [t('systemCoreDesc'), `${t('systemLegendPlugins')}: ${map.core.pluginCount}`] }
    }
    if (sel.type === 'service') {
      return { title: `ctx.${sel.item.key}`, lines: [t(sel.item.labelKey), `${t('systemStatus')}: ${sel.item.live ? t('systemLive') : t('systemDead')}`, ...(sel.item.detail ? [sel.item.detail] : [])] }
    }
    if (sel.type === 'plugin') {
      return {
        title: t(sel.item.labelKey),
        lines: [
          t(sel.item.descKey),
          `${t('systemProvides')}: ${sel.item.provides.map(k => `ctx.${k}`).join(', ') || '—'}`,
          `${t('systemDepends')}: ${sel.item.dependsOn.map(k => (k.startsWith('ctx.') ? k : k === 'platform-bridge' ? t('systemPlugBridge') : `ctx.${k}`)).join(', ') || '—'}`,
          `${t('systemStatus')}: ${sel.item.live ? t('systemLive') : t('systemDead')}`,
        ],
      }
    }
    if (sel.type === 'consumer') {
      return { title: t(sel.item.labelKey), lines: [`${t('systemUses')}: ${sel.item.uses.map(k => `ctx.${k}`).join(', ')}`] }
    }
    return {
      title: t(sel.item.labelKey),
      lines: [`${t('systemMilestone')}: ${sel.item.milestone}`, `${t('systemExtPlugsInto')}: ${sel.item.plugsInto.map(k => (k === 'core' ? map.core.name : `ctx.${k}`)).join(', ')}`],
    }
  })()

  return (
    <section className="space-y-2.5">
      <div className="rounded-card border overflow-auto" style={{ backgroundColor: theme.card, borderColor: theme.hairline }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={tint(theme.text, theme.card, 0.4)} />
            </marker>
            <marker id="arrowDim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={tint(theme.text, theme.card, 0.24)} />
            </marker>
          </defs>

          {/* consumers -> services */}
          {map.consumers.map((c, i) => {
            const p = consumerPos(i)
            return (
              <g key={c.id}>
                {c.uses.map(key => {
                  const from = { x: p.x + p.w, y: p.y + p.h / 2 }
                  const to = serviceLeft(key)
                  return line(from.x, from.y, to.x - 4, to.y, { color: tint(theme.text, theme.card, 0.22) })
                })}
                {node(p, sel?.type === 'consumer' && sel.item.id === c.id, () => setSel({ type: 'consumer', item: c }), (
                  <>
                    {dot(p.x + 16, p.y + p.h / 2, c.uses.every(k => serviceByKey(k)?.live))}
                    {labelText(p.x + 30, p.y + p.h / 2, t(c.labelKey), 12, theme.text, 600)}
                  </>
                ))}
              </g>
            )
          })}

          {/* core box */}
          {node(
            { x: serviceBox.x - 14, y: serviceBox.y - 40, w: serviceBox.w + 28, h: serviceBox.h + 56 },
            sel?.type === 'core',
            () => setSel({ type: 'core' }),
            <>
              {labelText(serviceBox.x + serviceBox.w / 2, serviceBox.y - 16, map.core.name, 13.5, theme.primary, 700, 'middle')}
              {labelText(serviceBox.x + serviceBox.w / 2, serviceBox.y + 2, t('systemCoreSub'), 10, theme.textMuted, 400, 'middle')}
            </>,
            { fill: tint(theme.primary, theme.card, 0.06) },
          )}
          {map.services.map((s, i) => {
            const c = serviceChip(i)
            return (
              <g key={s.key}>
                {node(c, sel?.type === 'service' && sel.item.key === s.key, () => setSel({ type: 'service', item: s }), (
                  <>
                    {dot(c.x + 14, c.y + c.h / 2, s.live)}
                    {labelText(c.x + 28, c.y + c.h / 2, `ctx.${s.key}`, 11.5, theme.text, 600)}
                    {s.detail && labelText(c.x + c.w - 10, c.y + c.h / 2, s.detail, 9, theme.textMuted, 400, 'end')}
                  </>
                ), { fill: tint(theme.primary, theme.card, 0.05) })}
              </g>
            )
          })}

          {/* plugins -> provided services */}
          {map.plugins.map((p, i) => {
            const pos = pluginPos(i)
            const isBridge = p.kind === 'platform'
            return (
              <g key={p.id}>
                {!isBridge && p.provides.map(key => {
                  const from = { x: pos.x, y: pos.y + pos.h / 2 }
                  const to = serviceCenter(key)
                  return line(from.x - 4, from.y, to.x + 6, to.y, { color: theme.primary })
                })}
                {p.dependsOn.map(depId => {
                  if (depId === 'platform-bridge') {
                    const bridge = map.plugins.findIndex(x => x.id === 'platform-bridge')
                    const bp = pluginPos(bridge)
                    return line(pos.x + pos.w / 2, pos.y + pos.h, pos.x + pos.w / 2, bp.y - 4, { dashed: true, color: tint(theme.text, theme.card, 0.24) })
                  }
                  const to = serviceCenter(depId)
                  return line(pos.x, pos.y + pos.h / 2 + 12, to.x + 6, to.y + 10, { dashed: true, color: tint(theme.text, theme.card, 0.24) })
                })}
                {node(pos, sel?.type === 'plugin' && sel.item.id === p.id, () => setSel({ type: 'plugin', item: p }), (
                  <>
                    {dot(pos.x + 16, pos.y + pos.h / 2, p.live)}
                    {labelText(pos.x + 30, pos.y + pos.h / 2 - (isBridge ? 0 : 8), t(p.labelKey), 12, theme.text, 600)}
                    {labelText(pos.x + 30, pos.y + pos.h / 2 + 11, isBridge ? 'window.ipcRenderer' : t('systemLegendBuiltin'), 9.5, theme.textMuted, 400)}
                  </>
                ), { dashed: isBridge, fill: isBridge ? extNodeFill : nodeFill })}
              </g>
            )
          })}

          {/* extension slots */}
          <rect
            x={40} y={508} width={W - 80} height={110} rx={12}
            fill="transparent" stroke={theme.hairline} strokeDasharray="6 5"
          />
          {labelText(W / 2, 528, t('systemExtTitle'), 11, theme.textMuted, 600, 'middle')}
          {map.extensions.map((e, i) => {
            const p = extPos(i)
            return (
              <g key={e.id}>
                {e.plugsInto.map(key => {
                  const to = key === 'core'
                    ? { x: serviceBox.x + serviceBox.w / 2, y: serviceBox.y + serviceBox.h + 16 }
                    : serviceCenter(key)
                  const from = { x: p.x + p.w / 2, y: p.y }
                  const midY = (from.y + to.y) / 2
                  return (
                    <path
                      d={`M${from.x},${from.y} L${from.x},${midY} L${to.x},${midY} L${to.x},${to.y - 4}`}
                      fill="none" stroke={tint(theme.text, theme.card, 0.2)} strokeWidth={1.3}
                      strokeDasharray="4 4" markerEnd="url(#arrowDim)"
                    />
                  )
                })}
                {node(p, sel?.type === 'extension' && sel.item.id === e.id, () => setSel({ type: 'extension', item: e }), (
                  <>
                    {labelText(p.x + 12, p.y + p.h / 2 - 8, t(e.labelKey), 11.5, theme.textSecondary, 600)}
                    {labelText(p.x + 12, p.y + p.h / 2 + 11, `${t('systemMilestone')} ${e.milestone}`, 9.5, theme.textMuted, 400)}
                  </>
                ), { dashed: true, fill: extNodeFill })}
              </g>
            )
          })}
        </svg>
      </div>

      {/* detail panel */}
      <div
        className="rounded-card border px-4 py-3 min-h-[64px]"
        style={{ backgroundColor: theme.card, borderColor: sel ? tint(theme.primary, theme.card, 0.3) : theme.hairline }}
      >
        {detail ? (
          <div className="space-y-1">
            <p className="text-[12.5px] font-bold" style={{ color: theme.primary }}>{detail.title}</p>
            {detail.lines.map((l, i) => (
              <p key={i} className="text-[11.5px] leading-relaxed" style={{ color: theme.textSecondary }}>{l}</p>
            ))}
          </div>
        ) : (
          <p className="text-[11.5px]" style={{ color: theme.textMuted }}>{t('systemDetailHint')}</p>
        )}
      </div>

      {/* legend */}
      <div className="flex items-center gap-4 px-1 text-[10.5px]" style={{ color: theme.textMuted }}>
        <span className="flex items-center gap-1.5"><circle cx={0} cy={0} r={4} fill={liveColor} style={{ display: 'inline-block' }} />{t('systemLive')}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: deadColor }} />{t('systemDead')}</span>
        <span>— — {t('systemLegendExt')}</span>
      </div>
    </section>
  )
}

export default SystemMapSection
