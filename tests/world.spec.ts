import { expect, test } from '@playwright/test'

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
