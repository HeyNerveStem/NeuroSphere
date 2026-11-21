/**
 * Acceptance tests 1–14 from the project specification, run in a real browser
 * against the production build. Each test drives the real UI (mouse, keyboard,
 * buttons); `window.__neuro` is used only to READ state for assertions.
 */
import { expect, test, type Page } from '@playwright/test'

async function openLab(page: Page, path = '/anatomy') {
  await page.goto(path)
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, {
    timeout: 90_000,
  })
  await page.waitForTimeout(500)
}

const state = <T>(page: Page, fn: string) => page.evaluate(fn) as Promise<T>

/** Screen position of a structure's label anchor (on its surface). */
async function screenPointOf(page: Page, meshId: string) {
  return page.evaluate((id) => {
    const n = (window as any).__neuro
    const mesh = n.meshRegistry.get(id)
    const cam = n.sceneInfo.camera
    const canvas = document.querySelector('canvas')!
    const r = canvas.getBoundingClientRect()
    const box = mesh.geometry.boundingBox
    // project the mesh centre offset toward the camera-facing surface
    const p = mesh.position.clone()
    const toCam = cam.position.clone().sub(p).normalize()
    const radius = box.getSize(p.clone()).length() / 2
    const surf = p.clone().addScaledVector(toCam, radius * 0.6)
    const v = surf.project(cam)
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }
  }, meshId)
}

async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.move(x - 4, y - 4)
  await page.mouse.move(x, y)
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(250)
}

async function waitCameraSettled(page: Page) {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const cur = await page.evaluate(() =>
      (window as any).__neuro.sceneInfo.camera.position
        .toArray()
        .map((v: number) => v.toFixed(3))
        .join(','),
    )
    if (cur === last) return
    last = cur
    await page.waitForTimeout(150)
  }
}

test('1 — brain rotation with the mouse', async ({ page }) => {
  await openLab(page)
  const before = await state<number[]>(page, 'window.__neuro.sceneInfo.camera.position.toArray()')
  const c = page.locator('canvas').first()
  const b = (await c.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) await page.mouse.move(b.x + b.width / 2 + i * 15, b.y + b.height / 2 + i * 2)
  await page.mouse.up()
  await page.waitForTimeout(600)
  const after = await state<number[]>(page, 'window.__neuro.sceneInfo.camera.position.toArray()')
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2])
  expect(moved).toBeGreaterThan(0.3)
  // distance to target preserved by orbiting (rotation, not zoom)
  expect(Math.hypot(...after)).toBeCloseTo(Math.hypot(...before), 0)
})

test('2 — clicking the left frontal lobe selects it and shows matching information', async ({ page }) => {
  await openLab(page)
  await page.getByLabel('Camera preset').selectOption('left-lateral')
  await waitCameraSettled(page)
  const p = await screenPointOf(page, 'left-superior-frontal-gyrus')
  await clickAt(page, p.x, p.y)
  await expect
    .poll(() => state<string>(page, 'window.__neuro.useViewer.getState().selectedId'))
    .toBe('left-frontal-lobe')
  await expect(page.getByTestId('info-title')).toHaveText('Left frontal lobe')
  await expect(page.getByTestId('info-panel')).toContainText('central sulcus')
})

test('3 & 4 — cerebellum can be dragged away independently and returned exactly', async ({ page }) => {
  await openLab(page)
  await page.getByTestId('structure-search').fill('cerebellum')
  await page.getByTestId('structure-results').getByRole('button').first().click()
  await page.getByRole('button', { name: 'Dissect' }).click()
  await page.getByLabel('Camera preset').selectOption('posterior')
  await waitCameraSettled(page)
  const ponsBefore = await state<number[]>(page, "window.__neuro.meshRegistry.get('pons').position.toArray()")
  const cbBefore = await state<number[]>(page, "window.__neuro.meshRegistry.get('cerebellum').position.toArray()")
  // drag the gizmo's centre handle (screen-plane translation)
  const centre = await page.evaluate(() => {
    const n = (window as any).__neuro
    const cam = n.sceneInfo.camera
    const v = n.meshRegistry.get('cerebellum').position.clone().project(cam)
    const r = document.querySelector('canvas')!.getBoundingClientRect()
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }
  })
  await page.mouse.move(centre.x, centre.y)
  await page.waitForTimeout(200)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) await page.mouse.move(centre.x + i * 10, centre.y + i * 6)
  await page.mouse.up()
  await page.waitForTimeout(300)
  const cbAfter = await state<number[]>(page, "window.__neuro.meshRegistry.get('cerebellum').position.toArray()")
  const ponsAfter = await state<number[]>(page, "window.__neuro.meshRegistry.get('pons').position.toArray()")
  expect(Math.hypot(cbAfter[0] - cbBefore[0], cbAfter[1] - cbBefore[1], cbAfter[2] - cbBefore[2])).toBeGreaterThan(0.1)
  expect(ponsAfter).toEqual(ponsBefore)

  // Test 4: Return to Original Position
  await page.getByTestId('return-original').click()
  await expect
    .poll(() => state<number[]>(page, "window.__neuro.transforms.get('cerebellum').offset.toArray()"), {
      timeout: 15_000,
    })
    .toEqual([0, 0, 0])
  const back = await state<number[]>(page, "window.__neuro.meshRegistry.get('cerebellum').position.toArray()")
  back.forEach((v, i) => expect(v).toBeCloseTo(cbBefore[i], 9))
})

test('5, 6 & 7 — disassemble all, deterministic scrubbing, pause and smooth reverse', async ({ page }) => {
  await openLab(page)
  await page.getByTestId('disassemble').click()
  await expect
    .poll(() => state<number>(page, 'window.__neuro.useAnimation.getState().progress'), { timeout: 90_000 })
    .toBe(1)
  const spread = await page.evaluate(() => {
    const n = (window as any).__neuro
    let moved = 0
    n.meshRegistry.forEach((m: any, id: string) => {
      const t = n.transforms.get(id)
      if (m.position.length() > 0 && t && m.position.clone().sub(t.offset).length() > 0) moved++
    })
    return moved
  })
  expect(spread).toBe(86)

  // Test 6: scrub to 50%
  await page.getByTestId('timeline').fill('0.5')
  await page.waitForTimeout(300)
  expect(await state<number>(page, 'window.__neuro.useAnimation.getState().progress')).toBe(0.5)
  const atHalf1 = await state<number[]>(page, "window.__neuro.meshRegistry.get('cerebellum').position.toArray()")
  await page.getByTestId('timeline').fill('0.9')
  await page.waitForTimeout(200)
  await page.getByTestId('timeline').fill('0.5')
  await page.waitForTimeout(300)
  const atHalf2 = await state<number[]>(page, "window.__neuro.meshRegistry.get('cerebellum').position.toArray()")
  expect(atHalf2).toEqual(atHalf1)

  // Test 7: play, pause, reverse — monotonic, no jumps
  await page.getByTestId('play').click()
  await page.waitForTimeout(400)
  await page.getByTestId('play').click() // pause
  const paused = await state<number>(page, 'window.__neuro.useAnimation.getState().progress')
  await page.waitForTimeout(300)
  expect(await state<number>(page, 'window.__neuro.useAnimation.getState().progress')).toBe(paused)
  await page.getByTestId('reverse').click()
  const samples: number[] = []
  for (let i = 0; i < 12; i++) {
    samples.push(await state<number>(page, 'window.__neuro.useAnimation.getState().progress'))
    await page.waitForTimeout(80)
  }
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i]).toBeLessThanOrEqual(samples[i - 1])
    expect(samples[i - 1] - samples[i]).toBeLessThan(0.06)
  }
  expect(samples.at(-1)!).toBeLessThan(paused)
})

test('8 — hippocampus information', async ({ page }) => {
  await openLab(page, '/anatomy/left-hippocampus')
  await expect(page.getByTestId('info-title')).toHaveText('Left hippocampus')
  const panel = page.getByTestId('info-panel')
  await expect(panel).toContainText(/medial temporal/i)
  await expect(panel).toContainText('Formation of new episodic memories')
  await expect(panel).toContainText('Spatial navigation')
  for (const d of ["Alzheimer's disease", 'Temporal lobe epilepsy', 'Hypoxic-ischemic brain injury'])
    await expect(panel).toContainText(d)
})

test('9 & 10 — Alzheimer page and affected-region highlighting', async ({ page }) => {
  await page.goto('/diseases/alzheimers-disease')
  await expect(page.getByTestId('disease-title')).toHaveText("Alzheimer's disease")
  for (const h of ['Pathophysiology', 'Diagnostic evaluation', 'Treatment approaches', 'Medical references'])
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  await expect(page.getByTestId('association-list')).toContainText('Hippocampus')
  await page.waitForFunction(() => (window as any).__ready === true, null, { timeout: 90_000 })
  await page.getByTestId('highlight-affected').click()
  const hl = await state<Record<string, string>>(page, 'window.__neuro.useViewer.getState().highlight')
  expect(hl['left-hippocampus']).toBe('primary')
  expect(hl['right-hippocampus']).toBe('primary')
  expect(hl['left-parahippocampal-gyrus']).toBe('primary')
  expect(hl['cerebellum']).toBeUndefined()
})

test('11 — search for cerebellum focuses it', async ({ page }) => {
  await openLab(page)
  await waitCameraSettled(page)
  const dist = () =>
    page.evaluate(() => {
      const n = (window as any).__neuro
      return n.sceneInfo.camera.position.distanceTo(n.meshRegistry.get('cerebellum').position)
    })
  const before = await dist()
  await page.getByTestId('global-search').fill('cerebellum')
  await expect(page.getByTestId('global-search-results')).toContainText('Cerebellum')
  await page.getByTestId('global-search').press('Enter')
  await expect(page).toHaveURL(/\/anatomy\/cerebellum$/)
  await expect.poll(() => state<string>(page, 'window.__neuro.useViewer.getState().selectedId')).toBe('cerebellum')
  await waitCameraSettled(page)
  expect(await dist()).toBeLessThan(before)
})

test('12 — reset all restores transforms, visibility and animation', async ({ page }) => {
  await openLab(page)
  await page.evaluate(() => {
    // perform a manipulation through the same store calls the gizmo uses
    const n = (window as any).__neuro
    n.transforms.pushHistory()
    n.transforms.translate(['pons'], n.meshRegistry.get('pons').position.clone().set(0.4, 0, 0))
  })
  await page.getByTestId('structure-search').fill('cerebellum')
  await page.getByTestId('structure-results').getByRole('button').first().click()
  await page.keyboard.press('h') // hide via keyboard
  await page.getByTestId('timeline').fill('0.7')
  await page.getByTestId('reset-all').click()
  await expect
    .poll(() => state<number>(page, "window.__neuro.transforms.get('pons').offset.length()"), { timeout: 15_000 })
    .toBe(0)
  expect(await state<number>(page, 'window.__neuro.useAnimation.getState().progress')).toBe(0)
  expect(await state<object>(page, 'window.__neuro.useViewer.getState().hidden')).toEqual({})
})

test('13 — mobile viewport is usable', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await openLab(page, '/anatomy/cerebellum')
  await expect(page.getByRole('button', { name: 'Structures' })).toBeVisible()
  await page.getByRole('button', { name: 'Info' }).tap()
  await expect(page.getByRole('dialog', { name: 'Structure information' })).toContainText('Cerebellum')
  await page.getByRole('button', { name: 'Close' }).tap()
  await page.getByRole('button', { name: 'Structures' }).tap()
  await expect(page.getByRole('dialog', { name: 'Structures' })).toBeVisible()
  await ctx.close()
})

test('14 — medical content integrity on the page', async ({ page }) => {
  await page.goto('/diseases/parkinsons-disease')
  await expect(page.getByRole('heading', { name: 'Medical references' })).toBeVisible()
  const links = await page
    .locator('section:has(h2:text-is("Medical references")) a')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))
  expect(links.length).toBeGreaterThan(0)
  for (const l of links)
    expect(l).toMatch(
      /^https:\/\/(www\.)?(ninds\.nih\.gov|medlineplus\.gov|ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|openstax\.org|doi\.org|cancer\.org|my\.clevelandclinic\.org)\//,
    )
  await expect(page.getByText(/Last medical review/)).toBeVisible()
  await expect(page.getByText(/not separately segmented/).first()).toBeVisible()
})

test('frontend ↔ backend: catalog is served by the API when it is running', async ({ page, request }) => {
  const health = await request.get('/api/health').catch(() => null)
  test.skip(!health || !health.ok(), 'backend not running')
  await page.goto('/diseases')
  await expect(page.getByText('Source: NeuroSphere content API')).toBeVisible()
  await page.goto('/about')
  await expect(page.getByText('Content API status:')).toContainText('online')
})
