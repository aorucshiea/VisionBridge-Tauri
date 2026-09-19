/**
 * Builtin `ctx.capture` provider — wraps the platform screenshot bridge.
 *
 * M2 will grow this into the agent-facing screen tool surface (capture the
 * focused display, capture region, read clipboard, ...); M1 only funnels the
 * existing region capture through the harness seam.
 */
import { Context, Service } from '@cordisjs/core'
import { captureRegion } from '../../lib/screenshot'
import type { CaptureService, ScreenshotRegion } from '../services'

export class Capture extends Service implements CaptureService {
  static [Service.provide] = 'capture'
  static [Service.immediate] = true

  constructor(ctx: Context) {
    super(ctx)
  }

  async region(region: ScreenshotRegion): Promise<string> {
    return await captureRegion(region)
  }
}
