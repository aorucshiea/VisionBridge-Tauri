/**
 * The VisionBridge harness: a cordis runtime living in the renderer.
 *
 * Every capability (model access, screen capture, later: agent loop, sessions,
 * tools, profiles) is a plugin contributing a named service to the shared
 * context. Consumers resolve services by key (`ctx.llm`) instead of importing
 * implementations, and plugin registrations are reversible effects.
 *
 * The context is a module singleton started once per window. Popup windows
 * (result card, mask, toolbar) never start it — only the main window does,
 * and they keep using the direct IPC contract as before.
 */
import { Context } from '@cordisjs/core'
import { Llm } from './plugins/llm'
import { Capture } from './plugins/capture'

let root: Context | null = null

export function startHarness(): Context {
  if (root) return root
  const ctx = new Context()
  ctx.plugin(Llm)
  ctx.plugin(Capture)
  ctx.emit('harness/ready')

  // Testing/inspection seam — also our WebView spike marker.
  ;(window as any).__VB_HARNESS__ = ctx
  root = ctx
  return ctx
}

/** The harness context (starts it on first use). */
export function harness(): Context {
  return startHarness()
}

// Typed events of the runtime itself.
declare module '@cordisjs/core' {
  interface Events {
    'harness/ready': () => void
  }
}
