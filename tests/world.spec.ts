import { expect, test } from '@playwright/test'

interface Point {
  x: number
  y: number
}

test('renders the meadow and supports the main simulation controls', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /THREE|WebGL|shader/i.test(message.text())
    )
      errors.push(message.text())
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Drop a treat' })).toBeEnabled()
  await expect(page.locator('[data-testid="world"] canvas')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Pause simulation', exact: true })
    .click()
  await expect(page.getByText('A moment of stillness')).toBeVisible()
  await page.screenshot({ path: 'test-results/meadow-desktop.png' })
  await page.getByRole('button', { name: 'Follow this little friend' }).click()
  await expect(
    page.getByRole('button', { name: 'Following along' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'World settings' }).click()
  await page.getByRole('slider').fill('0.015')
  await expect(page.getByText('Dreamy', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Evening', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Moonlit evening')).toBeVisible()
  await page.getByRole('button', { name: 'Drop a treat' }).click()
  await page.locator('[data-testid="world"] canvas').click()
  await expect(page.getByRole('status')).toContainText('happy paws')
  await expect(
    page.getByRole('button', { name: 'Pause simulation', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '100 cats' }).click()
  await expect(page.locator('.resident-option')).toHaveCount(100)
  await page
    .getByRole('textbox', { name: 'Search residents' })
    .fill('nonexistent')
  await expect(page.locator('.resident-option')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search residents' }).fill('kabichan')
  await expect(page.locator('.resident-option')).toHaveCount(100)
  await page.locator('.resident-option').first().click()
  await expect(page.locator('.resident-copy h2')).toHaveText('kabichan')
  await page.getByRole('button', { name: 'Reset camera' }).click()
  await expect(
    page.getByRole('button', { name: 'Follow this little friend' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('fits a mobile screen and keeps controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Drop a treat' })).toBeEnabled()
  await page
    .getByRole('button', { name: 'Pause simulation', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: 'test-results/meadow-mobile.png' })
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Let’s wander' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('dragging on mobile in laser mode does not move camera or interrupt follow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Follow this little friend' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Follow this little friend' }).click()
  await expect(
    page.getByRole('button', { name: 'Following along' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Turn on laser pointer' }).click()
  await expect(
    page.getByRole('button', { name: 'Turn off laser pointer' }),
  ).toBeVisible()

  const canvas = page.locator('[data-testid="world"] canvas')
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width / 2 + 80,
      box.y + box.height / 2 + 80,
      { steps: 5 },
    )
    await page.mouse.up()
  }

  await expect(
    page.getByRole('button', { name: 'Following along' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Turn off laser pointer' }).click()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width / 2 + 80,
      box.y + box.height / 2 + 80,
      { steps: 5 },
    )
    await page.mouse.up()
  }
  await expect(
    page.getByRole('button', { name: 'Follow this little friend' }),
  ).toBeVisible()
})

test('can hide and reopen the resident spotlight', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.resident-card')).toBeVisible()
  await page.getByRole('button', { name: 'Hide resident spotlight' }).click()
  await expect(page.locator('.resident-card')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open resident spotlight' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open resident spotlight' }).click()
  await expect(page.locator('.resident-card')).toBeVisible()
})

test('treat hand cursor follows pointer and updates aiming state', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('[data-testid="world"] canvas')).toBeVisible()

  // Initially cursor element should not be rendered
  await expect(page.locator('.treat-hand-cursor')).toHaveCount(0)

  // Activate treat mode
  await page.getByRole('button', { name: 'Drop a treat' }).click()
  await expect(page.locator('.treat-hand-cursor')).toHaveCount(1)

  const canvas = page.locator('[data-testid="world"] canvas')
  const box = await canvas.boundingBox()
  if (box) {
    // Pointer move should position and display the cursor
    await page.mouse.move(box.x + 120, box.y + 120)
    await expect(page.locator('.treat-hand-cursor')).toBeVisible()
    await expect(page.locator('.treat-hand-badge')).toContainText(
      'Click & drag to toss',
    )

    // Aiming state
    await page.mouse.down()
    await expect(page.locator('.treat-hand-cursor')).toHaveClass(/is-aiming/)
    await expect(page.locator('.treat-hand-badge')).toContainText(
      'Release to toss!',
    )

    // Move while aiming
    await page.mouse.move(box.x + 180, box.y + 180, { steps: 3 })
    await expect(page.locator('.treat-hand-cursor')).toBeVisible()

    // Release to toss
    await page.mouse.up()
    await expect(page.locator('.treat-hand-cursor')).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText('happy paws')
  }
  expect(errors).toEqual([])
})

test.describe('on a phone', () => {
  test.use({
    viewport: { width: 412, height: 839 },
    hasTouch: true,
    isMobile: true,
  })

  test('pinching zooms the meadow, never the page', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('.explore-hint')).toContainText('Pinch to zoom')
    await page.getByRole('button', { name: 'Follow this little friend' }).tap()
    await expect(
      page.getByRole('button', { name: 'Following along' }),
    ).toBeVisible()

    const client = await page.context().newCDPSession(page)
    const pinch = async (a: Point, b: Point) => {
      const spread = (step: number) => [
        { x: a.x, y: a.y - step * 8, id: 1 },
        { x: b.x, y: b.y + step * 8, id: 2 },
      ]
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: spread(0),
      })
      for (let step = 1; step <= 8; step++)
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: spread(step),
        })
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
    }
    const shell = (await page.locator('.world-shell').boundingBox())!
    const x = shell.x + shell.width / 2
    const y = shell.y + shell.height * 0.4
    await pinch({ x, y: y - 30 }, { x, y: y + 30 })
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
    // A pinch zooms without dropping the cat being followed.
    await expect(
      page.getByRole('button', { name: 'Following along' }),
    ).toBeVisible()

    // A finger that lands on an overlay doesn't zoom the page either.
    const card = (await page.locator('.resident-card').boundingBox())!
    await pinch({ x: card.x + card.width / 2, y: card.y + 20 }, { x, y })
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
    expect(errors).toEqual([])
  })
})

for (const [width, height] of [
  [844, 390],
  [568, 320],
]) {
  test(`a phone on its side fits ${width}×${height} without scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Drop a treat' }),
    ).toBeEnabled()
    const layout = await page.evaluate(() => {
      const shell = document.querySelector('.world-shell')!
      const overlays = [
        '.resident-card',
        '.world-toolbar',
        '.weather',
        '.camera-controls',
        '.minimap',
        '.explore-hint',
      ]
        .map((selector) => document.querySelector(selector))
        .filter((el): el is Element => !!el && el.checkVisibility())
        .map((el) => el.getBoundingClientRect())
      const bounds = shell.getBoundingClientRect()
      const overlaps = (a: DOMRect, b: DOMRect) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
      return {
        scroll: document.documentElement.scrollHeight - window.innerHeight,
        outside: overlays.filter(
          (box) => box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1,
        ).length,
        collisions: overlays.filter((a, i) =>
          overlays.slice(i + 1).some((b) => overlaps(a, b)),
        ).length,
      }
    })
    expect(layout).toEqual({ scroll: 0, outside: 0, collisions: 0 })
  })
}
