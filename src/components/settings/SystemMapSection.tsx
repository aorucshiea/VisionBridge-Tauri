import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ConsumerInfo, ExtensionInfo, HarnessMap, PluginInfo, ServiceInfo } from '../../harness/describe'
import { describeHarness } from '../../harness/describe'
import { tint } from '../../theme/themes'
import type { ThemeConfig } from '../../types'
import type { TFunc } from './ui'

/**
 * 系统 section — a live topology map of the harness: the cordis core holding
 * the service registry, the builtin plugins around it, their consumers, and
 * the planned extension slots (dashed). Click any node for details.
 *
 * Two layouts share the data and the detail panel: a wide side-column graph
 * (desktop) and a narrow vertical stack (small windows), switched by
 * container width via ResizeObserver — an SVG scaled below ~0.6× becomes
 * unreadable, so the narrow layout re-flows instead of shrinking.
 */

type Selection =
  | { type: 'core' }
  | { type: 'service'; item: ServiceInfo }
  | { type: 'plugin'; item: PluginInfo }
  | { type: 'consumer'; item: ConsumerInfo }
  | { type: 'extension'; item: ExtensionInfo }

const SystemMapSection: React.FC<{ theme: ThemeConfig; t: TFunc }> = ({ theme, t }) => {
  const map: HarnessMap = useMemo(() => describeHarness(), [])
  const [sel, setSel] = useState<Selection | null>(null)
  const [wide, setWide] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= 700))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const liveColor = theme.success
  const deadColor = theme.danger
  const dimColor = tint(theme.text, theme.card, 0.24)
  const nodeFill = tint(theme.text, theme.card, 0.04)

  const dot = (cx: number, cy: number, live: boolean, r = 4.5) => (
    <circle cx={cx} cy={cy} r={r} fill={live ? liveColor : deadColor} />
  )

  const text = (x: number, y: number, s: string, size: number, color: string, weight = 500, anchor: 'start' | 'middle' | 'end' = 'start') => (
    <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight} textAnchor={anchor} dominantBaseline="middle">{s}</text>
  )

  const nodeG = (
    pos: { x: number; y: number; w: number; h: number },
    selected: boolean,
    onClick: () => void,
    content: React.ReactNode,
    opts: { dashed?: boolean; fill?: string } = {},
  ) => (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
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

  const edge = (d: string, dashed = false) => (
    <path d={d} fill="none" stroke={dashed ? dimColor : tint(theme.text, theme.card, 0.4)} strokeWidth={1.4} strokeDasharray={dashed ? '4 4' : undefined} markerEnd={dashed ? 'url(#arrowDim)' : 'url(#arrow)'} />
  )

  // ---- wide layout geometry -------------------------------------------------
  const W = 920
  const H = 640
  const serviceBox = { x: 352, y: 236, w: 216, h: 148 }
  const serviceChip = (i: number) => ({ x: serviceBox.x + 12, y: serviceBox.y + 34 + i * 34, w: serviceBox.w - 24, h: 26 })
  const pluginPos = (i: number) => ({ x: 700, y: 66 + i * 76, w: 190, h: 56 })
  const consumerPos = (i: number) => ({ x: 30, y: 58 + i * 84, w: 190, h: 56 })
  const extPos = (i: number) => ({ x: 60 + i * 208, y: 540, w: 190, h: 56 })
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

  const wideSvg = (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={tint(theme.text, theme.card, 0.4)} />
        </marker>
        <marker id="arrowDim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={dimColor} />
        </marker>
      </defs>

      {map.consumers.map((c, i) => {
        const p = consumerPos(i)
        return (
          <g key={c.id}>
            {c.uses.map(key => {
              const to = serviceLeft(key)
              return edge(`M${p.x + p.w},${p.y + p.h / 2} L${to.x - 4},${to.y}`)
            })}
            {nodeG(p, sel?.type === 'consumer' && sel.item.id === c.id, () => setSel({ type: 'consumer', item: c }), (
              <>
                {dot(p.x + 16, p.y + p.h / 2, c.uses.every(k => map.services.find(s => s.key === k)?.live))}
                {text(p.x + 30, p.y + p.h / 2, t(c.labelKey), 13, theme.text, 600)}
              </>
            ))}
          </g>
        )
      })}

      {nodeG(
        { x: serviceBox.x - 14, y: serviceBox.y - 40, w: serviceBox.w + 28, h: serviceBox.h + 56 },
        sel?.type === 'core',
        () => setSel({ type: 'core' }),
        <>
          {text(serviceBox.x + serviceBox.w / 2, serviceBox.y - 16, map.core.name, 14.5, theme.primary, 700, 'middle')}
          {text(serviceBox.x + serviceBox.w / 2, serviceBox.y + 2, t('systemCoreSub'), 10.5, theme.textMuted, 400, 'middle')}
        </>,
        { fill: tint(theme.primary, theme.card, 0.06) },
      )}
      {map.services.map((s, i) => {
        const c = serviceChip(i)
        return nodeG(c, sel?.type === 'service' && sel.item.key === s.key, () => setSel({ type: 'service', item: s }), (
          <>
            {dot(c.x + 14, c.y + c.h / 2, s.live)}
            {text(c.x + 28, c.y + c.h / 2, `ctx.${s.key}`, 12.5, theme.text, 600)}
            {s.detail && text(c.x + c.w - 10, c.y + c.h / 2, s.detail, 9.5, theme.textMuted, 400, 'end')}
          </>
        ), { fill: tint(theme.primary, theme.card, 0.05) })
      })}

      {map.plugins.map((p, i) => {
        const pos = pluginPos(i)
        const isBridge = p.kind === 'platform'
        return (
          <g key={p.id}>
            {!isBridge && p.provides.map(key => {
              const to = serviceCenter(key)
              return edge(`M${pos.x - 4},${pos.y + pos.h / 2} L${to.x + 6},${to.y}`)
            })}
            {p.dependsOn.includes('platform-bridge') && (() => {
              const bp = pluginPos(map.plugins.findIndex(x => x.id === 'platform-bridge'))
              return edge(`M${pos.x + pos.w / 2},${pos.y + pos.h} L${pos.x + pos.w / 2},${bp.y - 4}`, true)
            })()}
            {nodeG(pos, sel?.type === 'plugin' && sel.item.id === p.id, () => setSel({ type: 'plugin', item: p }), (
              <>
                {dot(pos.x + 16, pos.y + pos.h / 2, p.live)}
                {text(pos.x + 30, pos.y + pos.h / 2 - (isBridge ? 0 : 8), t(p.labelKey), 13, theme.text, 600)}
                {text(pos.x + 30, pos.y + pos.h / 2 + 12, isBridge ? 'window.ipcRenderer' : t('systemLegendBuiltin'), 10, theme.textMuted, 400)}
              </>
            ), { dashed: isBridge, fill: isBridge ? 'transparent' : nodeFill })}
          </g>
        )
      })}

      <rect x={40} y={508} width={W - 80} height={110} rx={12} fill="transparent" stroke={theme.hairline} strokeDasharray="6 5" />
      {text(W / 2, 528, t('systemExtTitle'), 11.5, theme.textMuted, 600, 'middle')}
      {map.extensions.map((e, i) => {
        const p = extPos(i)
        return (
          <g key={e.id}>
            {nodeG(p, sel?.type === 'extension' && sel.item.id === e.id, () => setSel({ type: 'extension', item: e }), (
              <>
                {text(p.x + 12, p.y + p.h / 2 - 9, t(e.labelKey), 12.5, theme.textSecondary, 600)}
                {text(p.x + 12, p.y + p.h / 2 + 12, `${t('systemMilestone')} ${e.milestone}`, 10, theme.textMuted, 400)}
              </>
            ), { dashed: true, fill: 'transparent' })}
          </g>
        )
      })}
    </svg>
  )

  // ---- narrow layout geometry (vertical stack) ------------------------------
  const N = 400
  const coreY = 16
  const chipY = (i: number) => coreY + 58 + i * 36
  const groupYs = { consumers: 268, plugins: 0, extensions: 0 }
  const consH = 30 + map.consumers.length * 36 + 8
  groupYs.plugins = groupYs.consumers + consH + 12
  const plugH = 30 + map.plugins.length * 44 + 8
  groupYs.extensions = groupYs.plugins + plugH + 12
  const extH = 30 + map.extensions.length * 36 + 8
  const NH = groupYs.extensions + extH + 14

  const narrowSvg = (
    <svg viewBox={`0 0 ${N} ${NH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <marker id="arrowN" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={tint(theme.text, theme.card, 0.4)} />
        </marker>
      </defs>

      {/* core */}
      {nodeG({ x: 10, y: coreY, w: N - 20, h: 174 }, sel?.type === 'core', () => setSel({ type: 'core' }), (
        <>
          {text(N / 2, coreY + 24, map.core.name, 15, theme.primary, 700, 'middle')}
          {text(N / 2, coreY + 42, t('systemCoreSub'), 10, theme.textMuted, 400, 'middle')}
        </>
      ), { fill: tint(theme.primary, theme.card, 0.06) })}
      {map.services.map((s, i) => {
        const c = { x: 24, y: chipY(i), w: N - 48, h: 30 }
        return nodeG(c, sel?.type === 'service' && sel.item.key === s.key, () => setSel({ type: 'service', item: s }), (
          <>
            {dot(c.x + 14, c.y + 15, s.live)}
            {text(c.x + 27, c.y + 15, `ctx.${s.key}`, 12.5, theme.text, 600)}
            {s.detail && text(c.x + c.w - 10, c.y + 15, s.detail, 9.5, theme.textMuted, 400, 'end')}
          </>
        ), { fill: tint(theme.primary, theme.card, 0.05) })
      })}
      <path d={`M${N / 2},${coreY + 174} L${N / 2},${groupYs.consumers - 5}`} fill="none" stroke={tint(theme.text, theme.card, 0.4)} strokeWidth={1.4} markerEnd="url(#arrowN)" />

      {/* consumers group */}
      {nodeG({ x: 10, y: groupYs.consumers, w: N - 20, h: consH }, false, () => {}, <></>, { fill: tint(theme.text, theme.card, 0.02) })}
      {text(20, groupYs.consumers + 16, t('systemConsGroup'), 11, theme.textMuted, 600)}
      {map.consumers.map((c, i) => {
        const r = { x: 20, y: groupYs.consumers + 26 + i * 36, w: N - 40, h: 32 }
        return nodeG(r, sel?.type === 'consumer' && sel.item.id === c.id, () => setSel({ type: 'consumer', item: c }), (
          <>
            {dot(r.x + 12, r.y + 16, c.uses.every(k => map.services.find(s => s.key === k)?.live), 4)}
            {text(r.x + 24, r.y + 16, t(c.labelKey), 12.5, theme.text, 600)}
            {text(r.x + r.w - 10, r.y + 16, `${t('systemUses')} ${c.uses.map(k => `ctx.${k}`).join(' · ')}`, 9.5, theme.textMuted, 400, 'end')}
          </>
        ))
      })}

      {/* plugins group */}
      {nodeG({ x: 10, y: groupYs.plugins, w: N - 20, h: plugH }, false, () => {}, <></>, { fill: tint(theme.text, theme.card, 0.02) })}
      {text(20, groupYs.plugins + 16, t('systemLegendPlugins'), 11, theme.textMuted, 600)}
      {map.plugins.map((p, i) => {
        const r = { x: 20, y: groupYs.plugins + 26 + i * 44, w: N - 40, h: 40 }
        return nodeG(r, sel?.type === 'plugin' && sel.item.id === p.id, () => setSel({ type: 'plugin', item: p }), (
          <>
            {dot(r.x + 12, r.y + 20, p.live, 4)}
            {text(r.x + 24, r.y + 14, t(p.labelKey), 12.5, theme.text, 600)}
            {text(r.x + 24, r.y + 30, p.provides.length ? `${t('systemProvides')} ${p.provides.map(k => `ctx.${k}`).join(' · ')}` : 'window.ipcRenderer', 9.5, theme.textMuted, 400)}
            {text(r.x + r.w - 10, r.y + 20, p.kind === 'platform' ? t('systemPlugBridge') : t('systemLegendBuiltin'), 9.5, p.kind === 'platform' ? theme.accent : theme.textMuted, 500, 'end')}
          </>
        ), { dashed: p.kind === 'platform' })
      })}

      {/* extensions group */}
      <rect x={10} y={groupYs.extensions} width={N - 20} height={extH} rx={10} fill="transparent" stroke={theme.hairline} strokeDasharray="6 5" />
      {text(20, groupYs.extensions + 16, t('systemExtTitle'), 11, theme.textMuted, 600)}
      {map.extensions.map((e, i) => {
        const r = { x: 20, y: groupYs.extensions + 26 + i * 36, w: N - 40, h: 32 }
        return nodeG(r, sel?.type === 'extension' && sel.item.id === e.id, () => setSel({ type: 'extension', item: e }), (
          <>
            {text(r.x + 12, r.y + 16, t(e.labelKey), 12.5, theme.textSecondary, 600)}
            {text(r.x + r.w - 10, r.y + 16, `${e.milestone} · ${t('systemExtPlugsInto')} ${e.plugsInto.map(k => (k === 'core' ? t('systemCore') : `ctx.${k}`)).join(' · ')}`, 9.5, theme.textMuted, 400, 'end')}
          </>
        ), { dashed: true, fill: 'transparent' })
      })}
    </svg>
  )

  // Selection detail ----------------------------------------------------------
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
          `${t('systemDepends')}: ${sel.item.dependsOn.map(k => (k === 'platform-bridge' ? t('systemPlugBridge') : `ctx.${k}`)).join(', ') || '—'}`,
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
      <div ref={boxRef} className="rounded-card border overflow-auto" style={{ backgroundColor: theme.card, borderColor: theme.hairline }}>
        {wide ? wideSvg : narrowSvg}
      </div>

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

      <div className="flex items-center gap-4 px-1 text-[10.5px]" style={{ color: theme.textMuted }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: liveColor }} />{t('systemLive')}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: deadColor }} />{t('systemDead')}</span>
        <span>— — {t('systemLegendExt')}</span>
      </div>
    </section>
  )
}

export default SystemMapSection
