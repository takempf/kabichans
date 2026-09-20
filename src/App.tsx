import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  Cat as CatIcon,
  Check,
  ChevronRight,
  CircleHelp,
  Cookie,
  Heart,
  Home,
  MapPin,
  Maximize2,
  Minus,
  Moon,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  Sprout,
  Sun,
  Sunset,
  Users,
  X,
} from 'lucide-react'
import { CatWorld, DEFAULT_CURVATURE } from './world/World'
import { TreatHandCursor } from './TreatHandCursor'
import type { Cat, Point, Snapshot, TimeOfDay } from './world/simulation'
import { CAT_COUNT } from './world/simulation'
import { COTTAGE_SIZE, FENCE_BOUNDS, houses } from './world/geography'
import { BRIDGE, CREEK_WIDTH, creekX, meadowPathX } from './world/terrain'
import { CAT_COAT_GRADIENT, CAT_COLORS, catFacePaint } from './world/catArtwork'

const portraitPaint = catFacePaint()

function CatPortrait({ shirt = '#a7b991' }: { shirt?: string }) {
  const faceClip = useId()
  const coatGradient = `${faceClip}-coat`
  return (
    <svg viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={coatGradient}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={CAT_COAT_GRADIENT.endY}
        >
          {CAT_COAT_GRADIENT.stops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
            />
          ))}
        </linearGradient>
        <clipPath id={faceClip}>
          <path d="M8 54C8 32 26 23 50 23S92 32 92 54C94 79 80 86 50 86S6 79 8 54Z" />
        </clipPath>
      </defs>
      <path d="M29 108 36 80h28l8 28" fill={shirt} />
      <path
        d="M13 43 15 7Q16 2 19 8L37 35M63 35 81 8Q84 2 85 7L87 43"
        fill={CAT_COLORS.coatShadow}
      />
      <path d="M18 35 19 15 30 35M70 35 81 15 82 35" fill={CAT_COLORS.ear} />
      <g clipPath={`url(#${faceClip})`}>
        <g transform="translate(4 22) scale(.09 .064)">
          {portraitPaint.map((mark, index) => (
            <path
              key={index}
              d={mark.path}
              fill={
                mark.gradient === 'coat' ? `url(#${coatGradient})` : mark.fill
              }
              stroke={mark.stroke}
              strokeWidth={mark.lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={
                mark.transform
                  ? `matrix(${mark.transform.join(' ')})`
                  : undefined
              }
            />
          ))}
        </g>
      </g>
      <path d="M43 85q7 5 14 0" stroke={CAT_COLORS.white} strokeWidth="3" />
      <path
        d="M51 102c-8-1-8-9-8-9 8 0 8 9 8 9Zm0 0c0-7 6-8 6-8s2 6-6 8"
        fill={CAT_COLORS.white}
      />
    </svg>
  )
}

function Dialog({
  title,
  close,
  children,
  wide = false,
}: {
  title: string
  close: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onCancel={close}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

function MiniMap({
  snapshot,
  selected,
  navigate,
  expanded,
}: {
  snapshot: Snapshot | null
  selected: number | null
  navigate: (point: Point) => void
  expanded: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = canvas.width,
      h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#dce6bb'
    ctx.fillRect(0, 0, w, h)
    const worldWidth = FENCE_BOUNDS.maxX - FENCE_BOUNDS.minX
    const worldDepth = FENCE_BOUNDS.maxZ - FENCE_BOUNDS.minZ
    const mapX = (x: number) => ((x - FENCE_BOUNDS.minX) / worldWidth) * w
    const mapZ = (z: number) => ((z - FENCE_BOUNDS.minZ) / worldDepth) * h
    for (const [path, width, color] of [
      [meadowPathX, 4.9, '#f4ecd2'],
      [creekX, CREEK_WIDTH, '#a5d6cc'],
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = (width / worldWidth) * w
      ctx.beginPath()
      for (let y = 0; y <= h; y += 2) {
        const x = mapX(path(FENCE_BOUNDS.minZ + (y / h) * worldDepth))
        if (y === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.fillStyle = '#bcab84'
    ctx.fillRect(
      mapX(BRIDGE.minX),
      mapZ(BRIDGE.z - BRIDGE.width / 2),
      ((BRIDGE.maxX - BRIDGE.minX) / worldWidth) * w,
      (BRIDGE.width / worldDepth) * h,
    )
    for (const house of houses) {
      ctx.fillStyle = '#bc9d80'
      ctx.fillRect(
        mapX(house.x - COTTAGE_SIZE.width / 2),
        mapZ(house.z - COTTAGE_SIZE.depth / 2),
        (COTTAGE_SIZE.width / worldWidth) * w,
        (COTTAGE_SIZE.depth / worldDepth) * h,
      )
    }
    // Cafe patio on mini map
    ctx.fillStyle = '#dfd1b8'
    ctx.beginPath()
    ctx.arc(mapX(-10.5), mapZ(1.5), (7.4 / worldWidth) * w, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d96b52'
    ctx.fillRect(
      mapX(-14.5),
      mapZ(0.2),
      (3.5 / worldWidth) * w,
      (2.6 / worldDepth) * h,
    )
    ctx.strokeStyle = '#bc9b77'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
    for (const cat of snapshot?.cats ?? []) {
      if (cat.cottage?.stage === 'inside') continue
      const x = mapX(cat.x)
      const y = mapZ(cat.z)
      ctx.beginPath()
      ctx.arc(x, y, cat.id === selected ? 4 : 1.7, 0, Math.PI * 2)
      ctx.fillStyle = cat.id === selected ? '#cb895b' : '#5c7861'
      ctx.fill()
      if (cat.id === selected) {
        ctx.strokeStyle = '#fff9e8'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }, [snapshot, selected])
  return (
    <canvas
      ref={ref}
      width={expanded ? 560 : 210}
      height={expanded ? 430 : 128}
      className="map-canvas"
      aria-label="Live map of all 100 cats. Click to move the camera."
      role="img"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        navigate({
          x:
            FENCE_BOUNDS.minX +
            ((event.clientX - rect.left) / rect.width) *
              (FENCE_BOUNDS.maxX - FENCE_BOUNDS.minX),
          z:
            FENCE_BOUNDS.minZ +
            ((event.clientY - rect.top) / rect.height) *
              (FENCE_BOUNDS.maxZ - FENCE_BOUNDS.minZ),
        })
      }}
    />
  )
}

const activityLabels = {
  wandering: 'Exploring the meadow',
  resting: 'Taking a little catnap',
  sitting: 'Sitting and watching the world',
  lying: 'Lying down in the grass',
  vomiting: 'Feeling queasy · throwing up',
  socializing: 'Making a new friend',
  conversing: 'Having a little discussion',
  snacking: 'On a snack adventure',
  working: 'Working a shift at the cafe',
  indoors: 'Inside a cottage',
}

function residentActivity(
  cat: Cat,
  residents: Cat[] = [],
  // Butterflies turn into fireflies after dark.
  critter = 'butterfly',
) {
  if (cat.cafeWorker) {
    const worker = cat.cafeWorker
    if (worker.state === 'reporting')
      return 'Trotting to the cafe to start a shift'
    if (worker.state === 'leaving')
      return 'Shift’s over · heading back to the meadow'
    if (worker.state === 'taking_order')
      return 'Working at the cafe · Taking an order'
    if (worker.state === 'prepping')
      return 'Working at the cafe · Prepping fresh treats'
    if (worker.state === 'serving')
      return worker.carriedItem === 'churu'
        ? 'Working at the cafe · Serving a Churu'
        : 'Working at the cafe · Serving a Cat Can'
    if (worker.state === 'clearing')
      return 'Working at the cafe · Clearing a table'
    if (worker.state === 'break') return 'On shift break at the cafe'
    return worker.role === 'barista'
      ? 'On duty at the cafe · Behind the counter'
      : 'On duty at the cafe · Server station'
  }
  if (cat.cafeCustomer) {
    const customer = cat.cafeCustomer
    const treat = customer.foodItem === 'churu' ? 'a Churu' : 'a Cat Can'
    if (customer.stage === 'joining') return 'Trotting to the cafe for a treat'
    if (customer.stage === 'queuing')
      return customer.place === 1
        ? 'In line at the cafe · Next to order'
        : `In line at the cafe · ${customer.place} cats ahead`
    if (customer.stage === 'ordering')
      return 'At the counter · Torn between a Can and a Churu'
    if (customer.stage === 'waiting')
      return `At the counter · Waiting for ${treat}`
    if (customer.stage === 'carrying')
      return customer.seatIndex === null
        ? `Carrying ${treat} to a sunny spot`
        : `Carrying ${treat} to a table`
    if (customer.stage === 'hopping_on') return 'Hopping up onto a stool'
    if (customer.stage === 'eating') return `At the cafe · Enjoying ${treat}`
    if (customer.stage === 'hopping_off') return 'Hopping down, very satisfied'
    return 'Leaving the cafe, very satisfied'
  }
  if (cat.cottage) {
    const stage = cat.cottage.stage
    if (stage === 'arriving')
      return cat.travelMode === 'trotting'
        ? 'Trotting over to a cottage'
        : 'Walking over to a cottage'
    if (stage === 'waiting') return 'Waiting at a cottage door'
    if (stage === 'entering') return 'Heading inside a cottage'
    if (stage === 'leaving') return 'Stepping out of a cottage'
    return 'Inside a cottage'
  }
  if (cat.conversationPhase === 'gathering') return 'Joining a conversation'
  if (cat.activity === 'snacking' && cat.snack) {
    if (cat.snack.stage === 'eating') return 'Nibbling a treat'
    if (cat.snack.stage === 'done') return 'Treat eaten · very satisfied'
  }
  if (
    cat.activity === 'snacking' ||
    cat.activity === 'conversing' ||
    cat.activity === 'vomiting'
  )
    return activityLabels[cat.activity]
  const objective = cat.objective
  if (objective?.kind === 'chase')
    return cat.travelMode === 'walking'
      ? `Following a ${critter}`
      : `Chasing a ${critter}`
  if (!objective && cat.butterflyId !== null)
    return `Watching a ${critter} flutter away`
  if (!objective) return activityLabels[cat.activity]
  const friend =
    residents.find((other) => other.id === objective.friendId)?.name ??
    'a friend'
  if (objective.phase === 'doing')
    return objective.kind === 'visit'
      ? `Catching up with ${friend}`
      : activityLabels[cat.activity]
  if (objective.kind === 'laser') return 'Chasing the red laser dot!'
  if (objective.kind === 'privacy')
    return 'Feeling queasy · finding a quiet spot'
  const travel =
    cat.travelMode === 'sprinting'
      ? 'Running'
      : cat.travelMode === 'trotting'
        ? 'Trotting'
        : 'Walking'
  if (objective.kind === 'visit') return `${travel} to visit ${friend}`
  if (objective.kind === 'rest') return 'Heading to a favorite napping spot'
  const place =
    objective.hangout === 'shade'
      ? 'the shade'
      : objective.hangout === 'cottage'
        ? 'a cottage'
        : objective.hangout === 'rock'
          ? 'a big rock'
          : objective.hangout === 'picnic'
            ? 'a picnic blanket'
            : 'a quiet clearing'
  return `${travel} to ${place}`
}
const times: {
  value: TimeOfDay
  label: string
  icon: typeof Sun
  time: string
}[] = [
  { value: 'day', label: 'Sunny afternoon', icon: Sun, time: '2:30 PM' },
  { value: 'golden', label: 'Golden hour', icon: Sunset, time: '6:15 PM' },
  { value: 'night', label: 'Moonlit evening', icon: Moon, time: '9:00 PM' },
]

export default function App() {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<CatWorld | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [selected, setSelected] = useState<number | null>(0)
  const [follow, setFollow] = useState(false)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [curvature, setCurvature] = useState(DEFAULT_CURVATURE)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [dialog, setDialog] = useState<
    'settings' | 'help' | 'residents' | 'map' | null
  >(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [holdingTreats, setHoldingTreats] = useState(false)
  const [isAimingTreats, setIsAimingTreats] = useState(false)
  const [laserActive, setLaserActive] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const stopFollowing = useCallback(() => setFollow(false), [])

  useEffect(() => {
    if (!host.current) return
    try {
      const w = new CatWorld(
        host.current,
        setSnapshot,
        (id) => {
          setSelected(id)
          setFollow(false)
        },
        stopFollowing,
        setError,
      )
      w.onHoldingTreatsChange = (holding) => {
        setHoldingTreats(holding)
      }
      w.onAimingChange = (aiming) => {
        setIsAimingTreats(aiming)
      }
      w.onLaserActiveChange = (active) => {
        setLaserActive(active)
      }
      w.onTossComplete = () => {
        if (paused) setPaused(false)
        notify('A little treat, a lot of happy paws.')
      }
      world.current = w
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The 3D world could not start.')
    }
    return () => {
      world.current?.dispose()
      world.current = null
      clearTimeout(noticeTimer.current)
    }
  }, [stopFollowing, paused])

  useEffect(() => {
    if (!holdingTreats) {
      setMousePos(null)
      setIsAimingTreats(false)
      return
    }
    const handlePointerMove = (e: PointerEvent): void => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [holdingTreats])

  useEffect(() => {
    world.current?.setOptions({
      paused,
      speed,
      curvature,
      timeOfDay,
      follow,
      selected,
      reducedMotion,
    })
  }, [paused, speed, curvature, timeOfDay, follow, selected, reducedMotion])

  const notify = (message: string) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4200)
  }
  const cat = selected === null ? null : snapshot?.cats[selected]
  const time = times.find((t) => t.value === timeOfDay)!
  const critter = timeOfDay === 'night' ? 'firefly' : 'butterfly'
  const TimeIcon = time.icon
  const chooseCat = (c: Cat) => {
    setSelected(c.id)
    setFollow(true)
    setDialog(null)
  }
  const shuffle = () => {
    const id =
      ((selected ?? -1) + 1 + Math.floor(Math.random() * (CAT_COUNT - 1))) %
      CAT_COUNT
    setSelected(id)
    setFollow(true)
  }
  const navigate = (point: Point) => {
    world.current?.goTo(point)
    setDialog(null)
  }

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./" aria-label="Kabichans home">
          <span className="brand-icon">
            <CatIcon size={26} strokeWidth={1.8} />
          </span>
          <span>
            kabichans<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-right">
          <button
            className="icon-button"
            onClick={() => setDialog('help')}
            aria-label="How to play"
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="icon-button"
            onClick={() => setDialog('settings')}
            aria-label="World settings"
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>

      <main
        className={`world-shell time-${timeOfDay} ${
          holdingTreats ? 'is-holding-treats' : ''
        } ${laserActive ? 'is-laser-active' : ''}`}
      >
        <TreatHandCursor
          active={holdingTreats}
          isAiming={isAimingTreats}
          position={mousePos}
        />
        <div ref={host} className="world-canvas" data-testid="world" />
        <div className="world-vignette" />
        {!snapshot && !error && (
          <div className="loading">
            <Sprout size={30} />
            <p>Waking up the meadow…</p>
          </div>
        )}
        {error && (
          <div className="error-state" role="alert">
            <CatIcon size={38} />
            <h2>A little trouble opening the world</h2>
            <p>
              This meadow needs a browser with WebGL 2 and hardware acceleration
              enabled.
            </p>
            <details>
              <summary>Technical details</summary>
              {error}
            </details>
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        <h1 className="visually-hidden">Kabichans</h1>
        <button
          className="weather"
          onClick={() =>
            setTimeOfDay(
              times[
                (times.findIndex((t) => t.value === timeOfDay) + 1) %
                  times.length
              ].value,
            )
          }
          aria-label="Change time of day"
        >
          <span className="weather-icon">
            <TimeIcon size={26} strokeWidth={1.4} />
          </span>
          <span>
            <strong>{time.time}</strong>
            <small>{time.label}</small>
          </span>
          <ChevronRight size={15} />
        </button>

        {notice && (
          <div className="toast" role="status">
            <Heart size={16} />
            {notice}
          </div>
        )}
        {paused && (
          <div className="pause-label">
            <Pause size={13} /> A moment of stillness
          </div>
        )}

        <aside className="resident-card">
          <div className="card-eyebrow">
            <span>RESIDENT SPOTLIGHT</span>
            <button
              className="tiny-button"
              onClick={shuffle}
              aria-label="Meet a random cat"
            >
              <Shuffle size={15} />
            </button>
          </div>
          <div className="resident-main">
            <div className="portrait">
              <CatPortrait shirt={cat?.shirt} />
            </div>
            <div className="resident-copy">
              <span className="resident-number">
                {cat
                  ? `NO. ${String(cat.id + 1).padStart(3, '0')}`
                  : 'SAY HELLO'}
              </span>
              <h2>{cat?.name ?? 'Meet a neighbor'}</h2>
              <p>{cat?.personality ?? 'Click any cat to get acquainted.'}</p>
            </div>
          </div>
          <div className="resident-activity">
            <span className={`activity-dot ${cat?.activity ?? ''}`} />
            {cat
              ? residentActivity(cat, snapshot?.cats, critter)
              : 'A new friend is just a click away'}
          </div>
          <button
            className={`follow-button ${follow ? 'is-following' : ''}`}
            disabled={!cat}
            onClick={() => setFollow(!follow)}
          >
            {follow ? <Check size={15} /> : <Heart size={15} />}
            {follow ? 'Following along' : 'Follow this little friend'}
            <ArrowUpRight size={15} />
          </button>
        </aside>

        <div className="bottom-center">
          <div className="explore-hint">
            <MousePointer2 size={13} /> Drag to explore <span>·</span> Scroll to
            zoom <span>·</span> Click a cat to say hello
          </div>
          <nav className="world-toolbar" aria-label="Simulation controls">
            <button
              className="population-button"
              onClick={() => setDialog('residents')}
            >
              <span className="toolbar-icon">
                <Users size={20} />
              </span>
              <span>
                <strong>
                  100 <span>cats</span>
                </strong>
              </span>
              <ChevronRight size={14} />
            </button>
            <span className="toolbar-divider" />
            <button
              className="play-button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
            >
              {paused ? (
                <Play size={17} fill="currentColor" />
              ) : (
                <Pause size={17} fill="currentColor" />
              )}
            </button>
            <button
              className="speed-button"
              onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
              aria-label={`Simulation speed ${speed}x. Click to change.`}
            >
              {speed}×
            </button>
            <span className="toolbar-divider" />
            <button
              className={`treat-button ${holdingTreats ? 'is-active' : ''}`}
              disabled={!snapshot || !!error}
              onClick={() => {
                const next = !holdingTreats
                if (next && laserActive) {
                  setLaserActive(false)
                  world.current?.setLaserActive(false)
                }
                setHoldingTreats(next)
                world.current?.setHoldingTreats(next)
                if (next) {
                  notify(
                    'Treats in hand. Click and drag in the meadow to toss!',
                  )
                }
              }}
              aria-label={
                holdingTreats ? 'Put treats away' : 'Drop a treat'
              }
            >
              <Cookie size={20} />
              <span>{holdingTreats ? 'Treats in hand' : 'Drop a treat'}</span>
              <Plus size={14} />
            </button>
            <span className="toolbar-divider" />
            <button
              className={`laser-button ${laserActive ? 'is-active' : ''}`}
              disabled={!snapshot || !!error}
              onClick={() => {
                const next = !laserActive
                if (next && holdingTreats) {
                  setHoldingTreats(false)
                  world.current?.setHoldingTreats(false)
                }
                setLaserActive(next)
                world.current?.setLaserActive(next)
                if (next) {
                  notify('Laser pointer on! Move your cursor to lead the cats.')
                }
              }}
              aria-label={
                laserActive
                  ? 'Turn off laser pointer'
                  : 'Turn on laser pointer'
              }
            >
              <Sparkles size={18} />
              <span>{laserActive ? 'Laser active' : 'Laser'}</span>
            </button>
          </nav>
        </div>

        <div className="right-controls">
          <div className="camera-controls">
            <button
              className="icon-button"
              aria-label="Zoom in"
              onClick={() => world.current?.zoomBy(-1)}
            >
              <Plus size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Zoom out"
              onClick={() => world.current?.zoomBy(1)}
            >
              <Minus size={18} />
            </button>
            <span />
            <button
              className="icon-button"
              aria-label="Reset camera"
              onClick={() => world.current?.home()}
            >
              <Home size={17} />
            </button>
          </div>
          <aside className="minimap">
            <div className="map-heading">
              <span>
                <MapPin size={12} /> YOUR LITTLE CORNER
              </span>
              <button
                className="tiny-button"
                aria-label="Expand map"
                onClick={() => setDialog('map')}
              >
                <Maximize2 size={12} />
              </button>
            </div>
            <MiniMap
              snapshot={snapshot}
              selected={selected}
              navigate={navigate}
              expanded={false}
            />
            <div className="map-footer">
              <span className="map-dot" />
              Cats <span>N ↑</span>
            </div>
          </aside>
        </div>
      </main>

      {dialog === 'settings' && (
        <Dialog title="Just your kind of day." close={() => setDialog(null)}>
          <label className="setting-label" htmlFor="curvature">
            A world that rolls away{' '}
            <span>
              {curvature < 0.006
                ? 'Subtle'
                : curvature > 0.012
                  ? 'Dreamy'
                  : 'Classic'}
            </span>
          </label>
          <input
            id="curvature"
            type="range"
            min="0.002"
            max="0.018"
            step="0.001"
            value={curvature}
            onChange={(e) => setCurvature(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>Gently curved</span>
            <span>A little more wonder</span>
          </div>
          <span className="setting-label">Time of day</span>
          <div className="time-options">
            {times.map((t) => (
              <button
                key={t.value}
                className={timeOfDay === t.value ? 'active' : ''}
                onClick={() => setTimeOfDay(t.value)}
              >
                <t.icon size={23} />
                <span>
                  {t.value === 'day'
                    ? 'Afternoon'
                    : t.value === 'golden'
                      ? 'Golden hour'
                      : 'Evening'}
                </span>
              </button>
            ))}
          </div>
          <label className="motion-setting">
            <span>
              <strong>Gentler motion</strong>
              <small>Less bobbing and swaying; instant camera panning.</small>
            </span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
          </label>
        </Dialog>
      )}
      {dialog === 'help' && (
        <Dialog title="Stay a little while." close={() => setDialog(null)}>
          <div className="help-row">
            <MousePointer2 />
            <div>
              <strong>Find your own little corner</strong>
              <p>
                Drag the meadow, or use WASD / arrow keys. Scroll or use + and −
                to get closer.
              </p>
            </div>
          </div>
          <div className="help-row">
            <CatIcon />
            <div>
              <strong>Make a friend</strong>
              <p>
                Click a cat to meet them. Follow along, or find someone in the
                resident directory.
              </p>
            </div>
          </div>
          <div className="help-row">
            <Cookie />
            <div>
              <strong>A little kindness goes a long way</strong>
              <p>
                Drop a treat near the center of your view. Nearby cats will come
                over for a snack.
              </p>
            </div>
          </div>
          <div className="help-row">
            <Sun />
            <div>
              <strong>Set your own pace</strong>
              <p>
                Pause, change the speed, or tap the clock for a new time of day.
                Settings adjust the rolling horizon.
              </p>
            </div>
          </div>
          <button
            className="primary-button full-width"
            onClick={() => setDialog(null)}
          >
            Let’s wander <ArrowUpRight size={16} />
          </button>
        </Dialog>
      )}
      {dialog === 'residents' && (
        <Dialog
          title="One hundred little neighbors."
          close={() => setDialog(null)}
          wide
        >
          <div className="population-stats">
            <span>
              <i className="activity-dot wandering" />
              {snapshot?.counts.wandering ?? 0} exploring
            </span>
            <span>
              <i className="activity-dot resting" />
              {snapshot?.counts.resting ?? 0} resting
            </span>
            <span>
              <i className="activity-dot sitting" />
              {snapshot?.counts.sitting ?? 0} sitting
            </span>
            <span>
              <i className="activity-dot lying" />
              {snapshot?.counts.lying ?? 0} lying down
            </span>
            <span>
              <i className="activity-dot vomiting" />
              {snapshot?.counts.vomiting ?? 0} queasy
            </span>
            <span>
              <i className="activity-dot socializing" />
              {snapshot?.counts.socializing ?? 0} socializing
            </span>
            <span>
              <i className="activity-dot conversing" />
              {snapshot?.counts.conversing ?? 0} chatting
            </span>
            <span>
              <i className="activity-dot snacking" />
              {snapshot?.counts.snacking ?? 0} snacking
            </span>
            <span>
              <i className="activity-dot indoors" />
              {snapshot?.counts.indoors ?? 0} indoors
            </span>
          </div>
          <label className="search-input">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Find a little friend…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search residents"
            />
          </label>
          <div className="resident-grid">
            {snapshot?.cats
              .filter((c) =>
                c.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  className="resident-option"
                  onClick={() => chooseCat(c)}
                >
                  <div className="small-portrait">
                    <CatPortrait shirt={c.shirt} />
                  </div>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{residentActivity(c, snapshot.cats, critter)}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            {snapshot &&
              !snapshot.cats.some((c) =>
                c.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="empty-state">
                  No little friends by that name. Try another?
                </p>
              )}
          </div>
        </Dialog>
      )}
      {dialog === 'map' && (
        <Dialog
          title="A little place in the world."
          close={() => setDialog(null)}
          wide
        >
          <p className="dialog-intro">
            Every dot is a neighbor. Click anywhere to wander over.
          </p>
          <MiniMap
            snapshot={snapshot}
            selected={selected}
            navigate={navigate}
            expanded
          />
          <div className="map-legend">
            <span className="map-dot" /> Your neighbors{' '}
            <span className="map-dot selected" /> Your little friend
          </div>
        </Dialog>
      )}
    </div>
  )
}
