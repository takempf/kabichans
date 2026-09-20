// Shared vector artwork: painted onto the 3D head and reused in resident portraits.
export const CAT_COLORS = {
  white: '#f7f4eb',
  tabby: '#8a8078',
  crown: '#151519',
  coatShadow: '#302c2d',
  stripe: '#19181b',
  ear: '#aa8880',
  ink: '#30312d',
  iris: '#b1c58a',
  pink: '#d5a09b',
}

// The light gray-brown cheek fur fades into an almost black crown.
// Canvas textures and SVG portraits use the same stops and artwork coordinates.
export const CAT_COAT_GRADIENT = {
  endY: 650,
  stops: [
    { offset: 0, color: CAT_COLORS.crown },
    { offset: 0.24, color: '#252326' },
    { offset: 0.55, color: '#504a48' },
    { offset: 1, color: CAT_COLORS.tabby },
  ],
}

interface Paint {
  path: string
  fill: string
  gradient?: 'coat'
  stroke?: string
  lineWidth?: number
  transform?: [number, number, number, number, number, number]
}

const blaze =
  'M0 606C92 632 172 618 225 585C286 550 321 524 351 454C394 352 438 292 473 212L485 230Q500 198 513 166L526 223 541 208C577 300 631 364 672 454C707 534 760 574 823 603C893 635 959 627 1024 606V1024H0Z'

const stripes = [
  'M423 0C408 70 420 139 443 197L416 166C386 104 385 54 389 0Z',
  'M485 0 482 85 462 157 449 120 452 0Z',
  'M544 0 566 111 555 160 527 85 516 0Z',
  'M596 0C620 75 606 143 583 194L614 163C645 99 649 41 630 0Z',
  'M264 0C280 94 290 190 346 271L307 248C252 181 237 95 226 0Z',
  'M727 0C720 104 703 193 664 267L701 242C748 170 762 80 765 0Z',
  'M0 287C95 287 172 311 237 359L180 352C117 328 67 326 0 330Z',
  'M0 397C86 387 155 411 193 440L145 443C92 422 49 427 0 439Z',
  'M0 499C71 474 133 492 180 519L121 525C66 512 34 529 0 539Z',
  'M1024 287C932 294 858 316 791 359L847 352C910 328 960 326 1024 330Z',
  'M1024 397C938 387 871 411 831 440L879 443C932 422 975 427 1024 439Z',
  'M1024 499C952 474 891 492 844 519L903 525C958 512 990 529 1024 539Z',
]

const eyeOutline =
  'M-112-10C-109-88-56-126 8-120C78-115 114-59 115 12C84 85 15 113-52 87C-91 64-109 28-112-10Z'

export const CAT_FACE_EXPRESSIONS = ['awake', 'asleep', 'sick'] as const

export function catFacePaint(
  expression: (typeof CAT_FACE_EXPRESSIONS)[number] = 'awake',
): Paint[] {
  const closed = expression !== 'awake'
  const { white, tabby, stripe, ink, iris, pink } = CAT_COLORS
  const paint: Paint[] = [
    { path: 'M0 0H1024V1024H0Z', fill: tabby, gradient: 'coat' },
    ...stripes.map((path) => ({ path, fill: stripe })),
    { path: blaze, fill: white },
  ]
  for (const side of [-1, 1]) {
    const transform: Paint['transform'] = [side, 0, 0, 1, 512 + side * 202, 486]
    if (closed) {
      paint.push({
        path:
          expression === 'sick' ? 'M-98-20 0 24 101-23' : 'M-102 13Q0 99 105 4',
        fill: 'none',
        stroke: ink,
        lineWidth: 34,
        transform,
      })
    } else {
      paint.push(
        { path: eyeOutline, fill: iris, stroke: ink, lineWidth: 20, transform },
        {
          path: 'M-91 17Q-56 91 7 88Q69 81 95 18Q69 59 12 63Q-49 68-91 17Z',
          fill: '#c4ce9f',
          transform,
        },
        {
          path: 'M0-102C-47-96-54 75-7 88C44 95 49-101 0-102Z',
          fill: ink,
          transform,
        },
        {
          path: 'M-111-9C-109-88-56-126 8-120C78-115 114-59 115 12',
          fill: 'none',
          stroke: ink,
          lineWidth: 42,
          transform,
        },
        {
          path: 'M-10 0A17 21 0 1 0 24 0A17 21 0 1 0-10 0',
          fill: white,
          transform: [1, 0, 0, 1, 489 + side * 202, 431],
        },
      )
    }
    // Local +x is the outer corner of either mirrored eye. A filled, tapered
    // flick stays readable at 480p and follows the lid as the expression changes.
    paint.push({
      path:
        expression === 'awake'
          ? 'M70-103C103-83 122-53 125-30Q154-40 184-85Q181 0 113 43L96 8Q100-50 70-103Z'
          : expression === 'asleep'
            ? 'M75 6Q117-8 176-62Q167 20 100 38L82 24Z'
            : 'M70-28Q114-49 174-92Q160-10 100 4L81-6Z',
      fill: ink,
      transform,
    })
  }
  paint.push(
    {
      path: 'M470 653Q512 640 554 653Q554 671 524 693Q512 703 500 693Q471 674 470 653Z',
      fill: pink,
    },
    {
      // The little charcoal mark on the photo cat's pink nose.
      path: 'M470 653 483 647 493 653 505 650 511 660Q491 670 473 663Z',
      fill: '#665550',
    },
    {
      path:
        expression === 'sick'
          ? 'M480 735a32 39 0 1 0 64 0a32 39 0 1 0-64 0Z'
          : 'M512 697V713M455 718Q480 742 512 713Q544 742 569 718',
      fill: expression === 'sick' ? '#79575a' : 'none',
      stroke: '#60534c',
      lineWidth: 12,
    },
    ...[-1, 1].flatMap((side): Paint[] => [
      {
        path: 'M78 4 242-9M84 30 249 42',
        fill: 'none',
        stroke: '#c1bdb1',
        lineWidth: 4,
        transform: [side, 0, 0, 1, 512, 674],
      },
      {
        path: 'M91-16h1M119-4h1M101 13h1',
        fill: 'none',
        stroke: '#a6a092',
        lineWidth: 5,
        transform: [side, 0, 0, 1, 512, 662],
      },
    ]),
  )
  return paint
}
