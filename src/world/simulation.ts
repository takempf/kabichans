import { meadowPathX, BRIDGE, creekX } from './terrain'
import {
  WORLD,
  trees,
  houses,
  obstacles,
  cafeObstacles,
  rocks,
  picnicBlankets,
  isWalkable,
} from './geography'
import type { Point, Obstacle, PicnicBlanket } from './geography'
import { findRoute, clearSegment } from './navigation'
import { createDialogue, DialogueMemory } from './dialogue'
import type { Dialogue } from './dialogue'
import {
  ALL_CAFE_SEATS,
  CAFE_BARISTA_STATION,
  CAFE_BREAK_BENCH,
  CAFE_KIOSK_DOOR,
  CAFE_KIOSK_ENTRANCE,
  CAFE_KIOSK_LANE,
  CAFE_STAFF_EXIT,
  CAFE_ORDER_SPOT,
  CAFE_PICKUP_EXIT,
  CAFE_QUEUE_CAPACITY,
  CAFE_QUEUE_SLOTS,
  CAFE_SERVER_STATIONS,
  CAFE_TABLES,
  CAFE_TERRACE_CENTER,
  CAFE_TERRACE_RADIUS,
  STOOL_CUSHION_HEIGHT,
  TABLE_SURFACE_HEIGHT,
  cafeLanePosition,
  isInCafeQueueLane,
  isOnCafeTerrace,
  isInsideCafeProp,
} from './cafe'
import type {
  CafeDeliveredFood,
  CafeFoodType,
  CafeWorkerCarriedItem,
} from './cafe'
import { createCafeOrder } from './dialogue'
import { createButterflies, stepButterfly } from './butterflies'
import {
  COTTAGE_CAPACITY,
  COTTAGE_LINE_LENGTH,
  cottageDoorway,
  cottageExitSpots,
  cottageLineSpot,
  isInCottageDoorway,
} from './cottageLayout'
import type { Butterfly } from './butterflies'
export type { Butterfly } from './butterflies'
export {
  WORLD,
  trees,
  rocks,
  picnicBlankets,
  houses,
  obstacles,
  isWalkable,
} from './geography'
export type { Point, Obstacle } from './geography'
export type {
  CafeDeliveredFood,
  CafeFoodType,
  CafeTable,
  CafeWorkerCarriedItem,
} from './cafe'
export const CAFE_WORKER_IDS = [4, 5, 6] as const

export const CAT_COUNT = 100
// Covers the broad head, raised arms, and swaying tail at the model's base scale.
export const CAT_RADIUS = 1
export const EXTENDED_POSE_RADIUS = 1.45
export const VOMIT_DURATION = 5
export const VOMIT_EMIT_TIME = 2.6
export const MAX_PUDDLES = 50
// Once a cat dozes off they stay asleep a good while: this long, plus up to
// NAP_SPREAD more.
export const NAP_SECONDS = 90
export const NAP_SPREAD = 60
// A little mark over a cat's head. A "!" means they have just noticed
// something and freeze for a beat before acting on it; "yum" follows a treat.
export type EmoteKind = 'queasy' | 'treat' | 'butterfly' | 'yum'
export const EMOTE_SECONDS: Record<EmoteKind, number> = {
  queasy: 1.4,
  treat: 1.4,
  butterfly: 1.4,
  yum: 2.2,
}
export const STARTLE_SECONDS = 0.5
// A snacking cat kneels, picks their treat up at this point, and takes
// about this long in all, give or take a little.
export const SNACK_PICKUP_TIME = 0.7
export const SNACK_EAT_TIME = 3.2
// How far in front of a cat their treat lies when they kneel for it.
export const SNACK_REACH = 0.7
const TREAT_SECONDS = 18
const LASER_ATTRACT_RADIUS = 5.0
const LASER_LOSE_INTEREST_RADIUS = 8.0
const MAX_LASER_CHASERS = 2
const MAX_TURN_SPEED = 2.4
const MAX_TURN_ACCELERATION = 8
export type Activity =
  | 'wandering'
  | 'resting'
  | 'sitting'
  | 'lying'
  | 'vomiting'
  | 'socializing'
  | 'conversing'
  | 'snacking'
  | 'working'
  | 'indoors'
export type TimeOfDay = 'day' | 'golden' | 'night'
export type HangoutKind = 'shade' | 'cottage' | 'clearing' | 'rock' | 'picnic'
export type TravelMode = 'walking' | 'trotting' | 'sprinting'
export const TRAVEL_SPEEDS: Record<TravelMode, number> = {
  walking: 1.25,
  trotting: 2.35,
  sprinting: 4.1,
}
export interface Intention {
  kind:
    | 'explore'
    | 'rest'
    | 'visit'
    | 'privacy'
    | 'chase'
    | 'cottage'
    | 'picnic'
    | 'laser'
  destination: Point
  hangout: HangoutKind | null
  friendId: number | null
  duration: number
}
export interface Appointment extends Intention {
  dueAt: number
  resume?: boolean
}
export interface Objective extends Intention {
  phase: 'traveling' | 'doing'
  startedAt: number
  deadline: number
  nextRouteAt: number
  // When following a butterfly breaks into a run; Infinity just follows.
  chaseAt?: number
}
export interface CafeWorkerState {
  // 0 is the barista's spot at the register; 1 and 2 are server stations.
  station: number
  role: 'barista' | 'server'
  state:
    | 'reporting'
    | 'idle'
    | 'taking_order'
    | 'prepping'
    | 'serving'
    | 'clearing'
    | 'break'
    | 'leaving'
  // The coworker a reporting cat has come to relieve.
  relievingId: number | null
  shiftStartedAt: number
  customerId: number | null
  // The treat being ordered, and who speaks each line while deciding.
  order: CafeFoodType | null
  orderSpeakers: ('customer' | 'barista')[]
  targetTableId: number | null
  carriedItem: CafeFoodType | null
  facing: number | null
  timer: number
  idleTimer: number
}
export interface CafeCustomerState {
  stage:
    | 'joining'
    | 'queuing'
    | 'ordering'
    | 'waiting'
    | 'carrying'
    | 'hopping_on'
    | 'eating'
    | 'hopping_off'
    | 'leaving'
  // Position in line; 0 is at the counter.
  place: number
  foodItem: CafeFoodType | null
  seatIndex: number | null
  spot: { x: number; z: number; heading: number } | null
  facing: number | null
  // Height above the ground while hopping onto, sitting on, or leaving a stool.
  elevation: number
  hop: number | null
  hopFrom: Point | null
  joinedAt: number
  timer: number
  duration: number
}
export interface CafeSeatState {
  index: number
  tableId: number
  x: number
  z: number
  heading: number
  approach: Point
  occupantId: number | null
  stage: 'free' | 'reserved' | 'eating' | 'clearing'
  assignedWorkerId: number | null
}
export interface CottageVisit {
  cottageId: number
  stage: 'arriving' | 'waiting' | 'entering' | 'inside' | 'leaving'
  // Place in the line beside the door.
  place: number
  // The walk through the doorway, while entering or leaving.
  path: Point[]
  // When the current stage began.
  since: number
}
export interface Cottage extends Point {
  id: number
  // Residents inside, in the order they came in.
  occupants: number[]
  // Residents waiting beside the door.
  line: number[]
  // Residents inside who are ready to head out.
  exitQueue: number[]
  // Whoever is passing through the door; one at a time.
  doorwayId: number | null
  lastThrough: 'in' | 'out'
  nextExitAt: number
}
export interface Cat extends Point {
  id: number
  name: string
  personality: string
  activity: Activity
  activityTime: number
  nextVomitAt: number
  pose: { sitting: number; lying: number; vomiting: number }
  heading: number
  angularVelocity: number
  velocity: Point
  blockedTime: number
  socialTarget: number | null
  conversationId: number | null
  conversationPhase: 'gathering' | 'discussing' | null
  discussion: number
  speaking: number
  dialogue: Dialogue | null
  hangout: HangoutKind | null
  objective: Objective | null
  schedule: Appointment[]
  favorites: { point: Point; kind: HangoutKind }[]
  friends: number[]
  // The butterfly this cat is following, chasing, or watching flutter off.
  butterflyId: number | null
  // What just caught this cat's attention, and when.
  emote: EmoteKind | null
  emoteAt: number
  // The treat this cat is going for, then kneeling to eat.
  snack: Snack | null
  kneel: number
  routine: number
  travelMode: TravelMode
  pace: number
  travelSpeed: number
  route: Point[]
  target: Point
  timer: number
  phase: number
  gait: number
  walking: number
  shirt: string
  scale: number
  cafeWorker: CafeWorkerState | null
  cafeCustomer: CafeCustomerState | null
  cottage: CottageVisit | null
}
// One piece from a dropped handful of treats, set aside for one cat.
export interface TreatPiece extends Point {
  id: number
  // Where to kneel for it, just behind the piece.
  spot: Point
  // 0 is the ring closest to where the treat landed.
  ring: number
  // The cat who has knelt down for it.
  catId: number | null
}
export interface Snack {
  pieceId: number
  spot: Point
  stage: 'approaching' | 'eating' | 'done'
  // When the cat set off, then when they knelt down for it.
  since: number
  // How long this cat takes to eat it, from kneeling down.
  eatTime: number
  detours: number
  // When to look around for a closer piece.
  rethinkAt: number
  // A piece the crowd kept them from reaching.
  blockedPieceId: number | null
}
export interface Puddle extends Point {
  createdAt: number
  heading: number
  scale: number
}

export interface Conversation {
  id: number
  members: number[]
  center: Point
  phase: 'gathering' | 'discussing'
  deadline: number
  speaker: number | null
  nextTurnAt: number
  dialogue: Dialogue | null
}

export function catRadius(cat: Cat) {
  const extended =
    cat.activity === 'lying' ||
    cat.activity === 'vomiting' ||
    cat.pose.lying > 0 ||
    cat.pose.vomiting > 0
  return (extended ? EXTENDED_POSE_RADIUS : CAT_RADIUS) * cat.scale
}

const KIOSK_BODY_RADIUS = 0.55
// Each line of a counter conversation stays up this long.
const ORDER_TURN_SECONDS = 2.6

export function isBehindCounter(point: Point) {
  return point.x > -19 && point.x < -10.2 && point.z > -0.3 && point.z < 2.1
}

// Behind the narrow counter, staff tuck in their arms and squeeze past each other.
export function bodyRadius(cat: Cat) {
  return cat.cafeWorker && isBehindCounter(cat)
    ? KIOSK_BODY_RADIUS * cat.scale
    : catRadius(cat)
}

// Sitting on (or hopping onto) a cafe stool, inside the stool's footprint.
export function isPerched(cat: Cat) {
  const customer = cat.cafeCustomer
  if (!customer || customer.seatIndex === null) return false
  return (
    customer.stage === 'eating' ||
    (customer.stage === 'hopping_off' && customer.elevation > 0) ||
    (customer.stage === 'hopping_on' && customer.hop !== null)
  )
}

const HOP_SECONDS = 0.55
const HOP_HEIGHT = 0.6

export function sharesSpace(cat: Cat, other: Cat) {
  return cat.cafeWorker !== null && other.cafeWorker !== null
}

// Passing through a cottage door, or out of sight inside.
export function isIndoors(cat: Cat) {
  const stage = cat.cottage?.stage
  return stage === 'entering' || stage === 'inside' || stage === 'leaving'
}

export function isHidden(cat: Cat) {
  return cat.cottage?.stage === 'inside'
}

// Reporting cats haven't put on the apron yet; leaving cats have hung it up.
export function isOnShift(cat: Cat) {
  const state = cat.cafeWorker?.state
  return state !== undefined && state !== 'reporting' && state !== 'leaving'
}

export interface Snapshot {
  cats: Cat[]
  counts: Record<Activity, number>
  elapsed: number
  treat: Point | null
  cafeQueue: number[]
  cafeSeats: CafeSeatState[]
  deliveredFoods: CafeDeliveredFood[]
  carriedItems: CafeWorkerCarriedItem[]
}

export function randomSeed(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const RESIDENT_NAME = 'kabichan'
const personalities = [
  'A little daydreamer',
  'Professional sunbeam finder',
  'Everyone’s best friend',
  'A very curious soul',
  'Snack enthusiast',
  'A gentle adventurer',
]
const shirts = [
  '#e5a58c',
  '#eac975',
  '#91bdb1',
  '#b6a5c7',
  '#a8bd78',
  '#8daec4',
]

// Bridge approach helper to prevent gatherings and traffic jams on the crossing.
export const isOnBridgeOrApproach = (x: number, z: number, margin = 0) =>
  x >= 13.0 - margin &&
  x <= 27.0 + margin &&
  Math.abs(z - BRIDGE.z) <= BRIDGE.width / 2 + 0.4 + margin
// Out over the water, ramps included.
const isOnBridgeDeck = (point: Point) =>
  point.x > BRIDGE.minX - 1 &&
  point.x < BRIDGE.maxX + 1 &&
  Math.abs(point.z - BRIDGE.z) < BRIDGE.width / 2
// Residents settle this far back from the approaches, leaving the lanes open.
const BRIDGE_KEEP_CLEAR = 1.2
// The creek curves east as it runs south, so no single x divides the banks.
const isWestBank = (point: Point) => point.x < creekX(point.z)

// A random spot on a picnic blanket, at least `margin` in from its edges.
function blanketSpot(
  blanket: PicnicBlanket,
  random: () => number,
  margin: number,
): Point {
  const along = (random() - 0.5) * Math.max(0, blanket.width - margin * 2)
  const across = (random() - 0.5) * Math.max(0, blanket.depth - margin * 2)
  const cos = Math.cos(blanket.angle),
    sin = Math.sin(blanket.angle)
  return {
    x: blanket.x + along * cos + across * sin,
    z: blanket.z - along * sin + across * cos,
  }
}

// Loose patches of open ground between landmarks, rather than one central magnet.
const clearings: Point[] = []
for (let z = WORLD.minZ + 6; z < WORLD.maxZ - 4; z += 8) {
  for (let x = WORLD.minX + 6; x < WORLD.maxX - 6; x += 8) {
    if (x >= 14 && x <= 26) continue
    const point = { x: x + Math.sin(z * 0.7) * 2, z: z + Math.cos(x * 0.6) * 2 }
    if (
      isWalkable(point.x, point.z, 4) &&
      !isOnBridgeOrApproach(point.x, point.z, 4) &&
      Math.abs(point.x - meadowPathX(point.z)) > 4 &&
      !isOnCafeTerrace(point.x, point.z, 1.0) &&
      !isInCafeQueueLane(point.x, point.z, 1.0) &&
      !isInCottageDoorway(point.x, point.z, 1.0)
    )
      clearings.push(point)
  }
}

export class Simulation {
  readonly cats: Cat[]
  readonly puddles: Puddle[] = []
  readonly conversations: Conversation[] = []
  readonly butterflies: Butterfly[]
  readonly cottages: Cottage[] = houses.map((house, id) => ({
    id,
    x: house.x,
    z: house.z,
    occupants: [],
    line: [],
    exitQueue: [],
    doorwayId: null,
    lastThrough: 'out',
    nextExitAt: 0,
  }))
  // Cat ids in line for the counter, front first.
  readonly cafeQueue: number[] = []
  readonly cafeSeats: CafeSeatState[] = ALL_CAFE_SEATS.map((seat, index) => ({
    index,
    tableId: seat.tableId,
    x: seat.x,
    z: seat.z,
    heading: seat.heading,
    approach: { ...seat.approach },
    occupantId: null,
    stage: 'free',
    assignedWorkerId: null,
  }))
  readonly deliveredFoods: CafeDeliveredFood[] = []
  private nextDeliveredFoodId = 1
  private nextCafeReliefAt = 90
  private cafeShiftDoneAt = new Map<number, number>()
  private nextCafeCustomerAt = 5
  private cafeReturnAt = new Map<number, number>()
  private cafeProgress = new Map<
    number,
    { destination: Point; best: number; since: number; attempts: number }
  >()
  elapsed = 0
  treat: Point | null = null
  laserTarget: Point | null = null
  private treatUntil = 0
  // Scattered pieces still on the ground.
  treatPieces: TreatPiece[] = []
  private nextTreatPieceId = 0
  private random: () => number
  private conversationRandom: () => number
  private mindRandom: () => number
  private nextConversationAt: number
  private nextConversationId = 0
  private dialogueRandom: () => number
  // Cafe choices draw from their own stream, apart from everyday wandering.
  private cafeRandom: () => number
  private butterflyRandom: () => number
  // Small, natural differences in how quickly each cat reacts.
  private reactionRandom: () => number
  // Cats who will notice the treat in a moment, and the piece set aside.
  private treatNotices: { catId: number; at: number }[] = []
  private chaseReadyAt = new Map<number, number>()
  private cottageRandom: () => number
  private nextCottageTripAt: number
  private cottageReadyAt = new Map<number, number>()
  private picnicRandom: () => number
  private nextPicnicTripAt: number
  private picnicReturnAt = new Map<number, number>()
  private nextDialogueId = 0
  // Recent topics and lines, so the meadow rarely hears the same thing twice.
  private dialogueMemory = new DialogueMemory()

  constructor(seed = 827) {
    this.random = randomSeed(seed)
    this.conversationRandom = randomSeed(seed ^ 0x43484154)
    this.mindRandom = randomSeed(seed ^ 0x4147454e)
    this.dialogueRandom = randomSeed(seed ^ 0x54414c4b)
    this.cafeRandom = randomSeed(seed ^ 0x43414645)
    this.butterflyRandom = randomSeed(seed ^ 0x4e414249)
    this.reactionRandom = randomSeed(seed ^ 0x4a495454)
    this.butterflies = createButterflies(this.butterflyRandom)
    this.cottageRandom = randomSeed(seed ^ 0x484f4d45)
    this.picnicRandom = randomSeed(seed ^ 0x4d494c4c)
    this.nextCottageTripAt = 15 + this.cottageRandom() * 20
    this.nextPicnicTripAt = 18 + this.picnicRandom() * 15
    this.nextConversationAt = 60 + this.conversationRandom() * 40
    this.cats = []
    for (let id = 0; id < CAT_COUNT; id++) {
      const scale = 0.88 + this.random() * 0.2
      const settling: Activity =
        id % 15 === 0
          ? 'lying'
          : id % 5 === 4
            ? 'resting'
            : id % 7 === 0
              ? 'sitting'
              : 'wandering'
      const radius =
        (settling === 'lying' || settling === 'resting'
          ? EXTENDED_POSE_RADIUS
          : CAT_RADIUS) * scale
      const isEastResident = id >= 85
      const p =
        id < 15
          ? this.point(-13, 13, -3, 13, radius, id, true)
          : isEastResident
            ? this.point(
                28,
                WORLD.maxX - 4,
                WORLD.minZ + 6,
                WORLD.maxZ - 6,
                radius,
                id,
                true,
              )
            : this.point(
                WORLD.minX,
                14,
                WORLD.minZ,
                WORLD.maxZ,
                radius,
                id,
                true,
              )
      // A seed always lays out the same meadow, but whoever lands by the
      // bridge starts the day on the move rather than settled in the way.
      const activity = isOnBridgeOrApproach(
        p.x,
        p.z,
        radius + BRIDGE_KEEP_CLEAR,
      )
        ? 'wandering'
        : settling
      this.cats.push({
        id,
        name: RESIDENT_NAME,
        ...p,
        target: { ...p },
        personality: personalities[id % personalities.length],
        activity,
        activityTime: 0,
        nextVomitAt: 12 + this.random() * 90,
        pose: {
          sitting: activity === 'sitting' ? 1 : 0,
          lying: activity === 'lying' || activity === 'resting' ? 1 : 0,
          vomiting: 0,
        },
        heading: (this.random() - 0.5) * 2.4,
        angularVelocity: 0,
        velocity: { x: 0, z: 0 },
        blockedTime: 0,
        socialTarget: null,
        conversationId: null,
        conversationPhase: null,
        discussion: 0,
        speaking: 0,
        dialogue: null,
        hangout: null,
        objective: null,
        schedule: [],
        favorites: [],
        friends: [],
        butterflyId: null,
        emote: null,
        emoteAt: 0,
        snack: null,
        kneel: 0,
        routine: 0,
        travelMode: 'walking',
        pace: 1,
        travelSpeed: 0,
        route: [],
        // Anyone already asleep has a good part of their nap still ahead.
        timer:
          activity === 'resting' || activity === 'lying'
            ? 20 + this.random() * NAP_SECONDS
            : 1 + this.random() * 9,
        phase: this.random() * Math.PI * 2,
        gait: 0,
        walking: 0,
        shirt: shirts[id % shirts.length],
        scale,
        cafeWorker: null,
        cafeCustomer: null,
        cottage: null,
      })
    }
    const westPlaces = [
      ...trees
        .filter((point) => point.x < 15)
        .map((point) => ({ point, kind: 'shade' as const })),
      ...houses.map((point) => ({ point, kind: 'cottage' as const })),
      ...clearings
        .filter((point) => point.x < 15)
        .map((point) => ({
          point: { ...point, radius: 0 },
          kind: 'clearing' as const,
        })),
    ]
    const eastPlaces = [
      ...trees
        .filter((point) => point.x > 26)
        .map((point) => ({ point, kind: 'shade' as const })),
      ...rocks.map((point) => ({ point, kind: 'rock' as const })),
      ...picnicBlankets.map((blanket) => ({
        point: { x: blanket.x, z: blanket.z, radius: 0 },
        kind: 'picnic' as const,
      })),
      ...clearings
        .filter((point) => point.x > 26)
        .map((point) => ({
          point: { ...point, radius: 0 },
          kind: 'clearing' as const,
        })),
    ]
    for (const cat of this.cats) {
      cat.pace = 0.88 + this.mindRandom() * 0.24
      cat.routine = Math.floor(this.mindRandom() * 3)
      if (cat.id >= 85) {
        cat.friends = [
          85 + ((cat.id - 85 + 5) % 15),
          85 + ((cat.id - 85 + 10) % 15),
        ]
      } else {
        cat.friends = [(cat.id + 17) % 85, (cat.id + 85 - 17) % 85]
      }
      cat.nextVomitAt = 65 + this.mindRandom() * 230
      const places = cat.id >= 85 ? eastPlaces : westPlaces
      for (
        let attempt = 0;
        attempt < 100 && cat.favorites.length < 3;
        attempt++
      ) {
        const place = places[Math.floor(this.mindRandom() * places.length)]
        const angle = this.mindRandom() * Math.PI * 2
        // Right on a blanket, or beside anything else.
        const radius =
          place.kind === 'picnic'
            ? this.mindRandom() * 0.9
            : place.point.radius + EXTENDED_POSE_RADIUS * cat.scale + 0.6
        const point = {
          x: place.point.x + Math.sin(angle) * radius,
          z: place.point.z + Math.cos(angle) * radius,
        }
        if (
          isWalkable(
            point.x,
            point.z,
            EXTENDED_POSE_RADIUS * cat.scale + 0.2,
          ) &&
          !isOnBridgeOrApproach(
            point.x,
            point.z,
            EXTENDED_POSE_RADIUS * cat.scale + BRIDGE_KEEP_CLEAR,
          ) &&
          Math.abs(point.x - meadowPathX(point.z)) > 3.1 &&
          !isOnCafeTerrace(point.x, point.z, 0.5) &&
          !isInCafeQueueLane(point.x, point.z, 0.5) &&
          !isInCottageDoorway(point.x, point.z, 1)
        )
          cat.favorites.push({ point, kind: place.kind })
      }
      this.fillSchedule(cat)
    }
    this.initCafeWorkers()
  }

  private point(
    minX = WORLD.minX,
    maxX = 14,
    minZ = WORLD.minZ,
    maxZ = WORLD.maxZ,
    radius = 0,
    id?: number,
    initialSpawn = false,
  ): Point {
    for (let i = 0; i < 100; i++) {
      const p = {
        x: minX + this.random() * (maxX - minX),
        z: minZ + this.random() * (maxZ - minZ),
      }
      if (this.canOccupy(p.x, p.z, radius, id, initialSpawn)) return p
    }
    // A crowded spawn region must never fall back to an occupied origin.
    for (let z = WORLD.minZ + 1.1; z < maxZ; z += 2.2) {
      for (let x = minX + 1.1; x < maxX; x += 2.2) {
        if (this.canOccupy(x, z, radius, id, initialSpawn)) return { x, z }
      }
    }
    throw new Error('No free space remains in the meadow')
  }

  private canOccupy(
    x: number,
    z: number,
    radius: number,
    id?: number,
    initialSpawn = false,
  ): boolean {
    if (!isWalkable(x, z, Math.max(0.45, radius))) return false
    // The bridge and its approaches are for passing through, never settling.
    if (!initialSpawn && isOnBridgeOrApproach(x, z, radius + BRIDGE_KEEP_CLEAR))
      return false
    const isWorker = Boolean(this.catById(id)?.cafeWorker)
    if ((initialSpawn || !isWorker) && isInsideCafeProp(x, z, 0.4)) {
      return false
    }
    if (
      !isWorker &&
      Math.hypot(x - CAFE_KIOSK_ENTRANCE.x, z - CAFE_KIOSK_ENTRANCE.z) <=
        CAFE_KIOSK_ENTRANCE.radius + radius
    )
      return false
    return (
      radius === 0 ||
      this.cats.every((other) => {
        if (other.id === id) return true
        const clearance = radius + catRadius(other)
        return (x - other.x) ** 2 + (z - other.z) ** 2 >= clearance ** 2
      })
    )
  }

  private canMove(cat: Cat, x: number, z: number) {
    // Staff only stay slim while the whole step is behind the counter.
    const radius = isBehindCounter({ x, z }) ? bodyRadius(cat) : catRadius(cat)
    if (!clearSegment(cat, { x, z }, radius, this.staffOnly(cat))) return false
    return this.clearOfCats(cat, x, z, radius)
  }

  // A straight step that stays clear of every other resident.
  private clearOfCats(cat: Cat, x: number, z: number, radius: number) {
    const dx = x - cat.x,
      dz = z - cat.z
    const lengthSquared = dx * dx + dz * dz
    return this.cats.every((other) => {
      if (other.id === cat.id || sharesSpace(cat, other)) return true
      const t = lengthSquared
        ? Math.max(
            0,
            Math.min(
              1,
              ((other.x - cat.x) * dx + (other.z - cat.z) * dz) / lengthSquared,
            ),
          )
        : 0
      return (
        (cat.x + dx * t - other.x) ** 2 + (cat.z + dz * t - other.z) ** 2 >=
        (radius + bodyRadius(other)) ** 2 - 1e-9
      )
    })
  }

  // Obstacles that only cafe staff may pass.
  private staffOnly(cat: Cat) {
    return cat.cafeWorker ? [] : [CAFE_KIOSK_ENTRANCE]
  }

  private hangoutCrowding(point: Point, exclude: number) {
    let crowding = 0
    for (const other of this.cats) {
      if (other.id === exclude) continue
      const present = Math.max(
        0,
        1 - Math.hypot(point.x - other.x, point.z - other.z) / 5.5,
      )
      const expected =
        other.hangout && other.objective?.phase === 'traveling'
          ? Math.max(
              0,
              1 -
                Math.hypot(
                  point.x - other.objective.destination.x,
                  point.z - other.objective.destination.z,
                ) /
                  5.5,
            )
          : 0
      crowding += Math.max(present, expected)
    }
    return crowding
  }

  private clearApproach(from: Point, to: Point, radius: number) {
    return clearSegment(from, to, radius)
  }

  private fillSchedule(cat: Cat) {
    if (cat.cafeWorker !== null) return
    while (cat.schedule.length < 3) {
      const kind = (['explore', 'rest', 'visit'] as const)[cat.routine++ % 3]
      const favorite =
        cat.favorites[Math.floor(this.mindRandom() * cat.favorites.length)]
      cat.schedule.push({
        kind,
        dueAt: cat.schedule.length
          ? Math.max(this.elapsed, cat.schedule.at(-1)!.dueAt) +
            65 +
            this.mindRandom() * 50
          : this.elapsed + this.mindRandom() * 10,
        destination: {
          x: favorite?.point.x ?? cat.x,
          z: favorite?.point.z ?? cat.z,
        },
        hangout: kind === 'visit' ? null : (favorite?.kind ?? 'clearing'),
        friendId:
          kind === 'visit'
            ? cat.friends[Math.floor(this.mindRandom() * cat.friends.length)]
            : null,
        duration:
          kind === 'visit'
            ? 12 + this.mindRandom() * 8
            : 16 + this.mindRandom() * 12,
      })
    }
  }

  private beginObjective(cat: Cat, intention: Intention) {
    this.startActivity(
      cat,
      intention.kind === 'visit' ? 'socializing' : 'wandering',
      120,
    )
    cat.objective = {
      ...intention,
      destination: { ...intention.destination },
      phase: 'traveling',
      startedAt: this.elapsed,
      deadline:
        this.elapsed +
        (intention.kind === 'privacy'
          ? 65
          : intention.kind === 'chase'
            ? intention.duration
            : 115),
      nextRouteAt: this.elapsed,
    }
    cat.hangout = intention.hangout
    cat.socialTarget = intention.friendId
    const distance = Math.hypot(
      cat.x - intention.destination.x,
      cat.z - intention.destination.z,
    )
    cat.travelMode =
      intention.kind === 'privacy'
        ? 'sprinting'
        : intention.kind === 'visit' ||
            (distance > 15 &&
              (intention.kind === 'explore' || intention.kind === 'cottage'))
          ? 'trotting'
          : 'walking'
    if (intention.kind !== 'chase') this.routeObjective(cat)
  }

  private updateVisitDestination(cat: Cat, objective: Objective) {
    const friend = this.cats.find((other) => other.id === objective.friendId)
    if (!friend) {
      objective.deadline = this.elapsed
      return
    }
    const angle = Math.atan2(cat.x - friend.x, cat.z - friend.z)
    const spacing = catRadius(cat) + catRadius(friend) + 0.85
    for (const offset of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) {
      const point = {
        x: friend.x + Math.sin(angle + offset) * spacing,
        z: friend.z + Math.cos(angle + offset) * spacing,
      }
      if (
        this.canOccupy(point.x, point.z, CAT_RADIUS * cat.scale + 0.05, cat.id)
      ) {
        objective.destination = point
        break
      }
    }
  }

  private routeBridgeCrossing(
    cat: Cat,
    objective: Objective,
    radius: number,
    blockers: Obstacle[],
    goingEast: boolean,
  ) {
    const laneOffset = 1.5
    const laneZ = goingEast ? BRIDGE.z - laneOffset : BRIDGE.z + laneOffset
    const approach = { x: goingEast ? 13.5 : 26.5, z: laneZ }
    const exitPoint = { x: goingEast ? 26.5 : 13.5, z: laneZ }
    // Today's neighbors will have moved on by the far bank, so only scenery
    // shapes that leg. Without one, a straight line from the exit would
    // leave the cat parked there, corking the lane.
    const exitPath = findRoute(exitPoint, objective.destination, radius + 0.08)
    if (!exitPath.length) return false
    // Already out on the deck, or lined up in their own lane at the near end,
    // with a clear run to the far end: no doubling back. Anyone else joins
    // the lane properly rather than cutting in against oncoming traffic.
    const lined =
      (isOnBridgeDeck(cat) ||
        (Math.abs(cat.z - laneZ) < 1 && Math.abs(cat.x - approach.x) < 1.5)) &&
      clearSegment(cat, exitPoint, radius)
    if (lined) cat.route = [exitPoint, ...exitPath]
    else {
      let toApproach = findRoute(cat, approach, radius + 0.08, blockers)
      if (!toApproach.length)
        toApproach = findRoute(cat, approach, radius + 0.08)
      cat.route = [
        ...(toApproach.length ? toApproach : [approach]),
        exitPoint,
        ...exitPath,
      ]
    }
    cat.target = cat.route[0]
    objective.nextRouteAt = this.elapsed + 2.5
    return true
  }

  private routeObjective(cat: Cat, avoidResidents = false) {
    const objective = cat.objective
    if (!objective) return
    if (objective.kind === 'visit') this.updateVisitDestination(cat, objective)
    const blockers = avoidResidents
      ? this.cats
          .filter(
            (other) =>
              other.id !== cat.id &&
              Math.hypot(other.x - cat.x, other.z - cat.z) >
                catRadius(other) + CAT_RADIUS * cat.scale + 0.3,
          )
          .map((other) => ({
            x: other.x,
            z: other.z,
            radius: catRadius(other) + 0.08,
          }))
      : []
    const radius = CAT_RADIUS * cat.scale
    const toWest = isWestBank(objective.destination)
    // Anyone out on the deck leaves by their own lane, even after a change of plans.
    if (
      (isWestBank(cat) !== toWest || isOnBridgeDeck(cat)) &&
      this.routeBridgeCrossing(cat, objective, radius, blockers, !toWest)
    )
      return
    cat.route = findRoute(cat, objective.destination, radius + 0.08, blockers)
    if (!cat.route.length)
      cat.route = findRoute(cat, objective.destination, radius, blockers)
    if (!cat.route.length && blockers.length > 0)
      cat.route = findRoute(cat, objective.destination, radius)
    cat.target = cat.route[0] ?? { x: cat.x, z: cat.z }
    objective.nextRouteAt = this.elapsed + 2.5
  }

  private privateSpot(cat: Cat) {
    let best: Point | null = null
    let score = Infinity
    for (let attempt = 0; attempt < 70; attempt++) {
      const angle = this.mindRandom() * Math.PI * 2
      const distance = 5 + this.mindRandom() * 13
      const point = {
        x: cat.x + Math.sin(angle) * distance,
        z: cat.z + Math.cos(angle) * distance,
      }
      if (
        !this.canOccupy(
          point.x,
          point.z,
          EXTENDED_POSE_RADIUS * cat.scale + 0.2,
          cat.id,
        ) ||
        // Somewhere quiet on this side of the creek, not a dash over the bridge.
        isWestBank(point) !== isWestBank(cat) ||
        Math.abs(point.x - meadowPathX(point.z)) < 3.2 ||
        isInCottageDoorway(point.x, point.z, 1)
      )
        continue
      const crowding = this.cats.reduce(
        (sum, other) =>
          sum +
          (other.id === cat.id
            ? 0
            : Math.max(
                0,
                1 - Math.hypot(point.x - other.x, point.z - other.z) / 8,
              )),
        0,
      )
      const candidate = crowding * 30 + distance * 0.15
      if (candidate < score) {
        best = point
        score = candidate
      }
    }
    return best
  }

  private resumeObjective(cat: Cat) {
    if (!cat.objective) return
    cat.objective.phase = 'traveling'
    cat.objective.deadline = this.elapsed + 100
    this.startActivity(
      cat,
      cat.objective.kind === 'visit' ? 'socializing' : 'wandering',
      120,
    )
    cat.hangout = cat.objective.hangout
    cat.socialTarget = cat.objective.friendId
    cat.travelMode =
      cat.objective.kind === 'privacy'
        ? 'sprinting'
        : cat.objective.kind === 'visit'
          ? 'trotting'
          : 'walking'
    this.routeObjective(cat)
  }

  private updateObjective(cat: Cat) {
    const objective = cat.objective
    if (
      !objective ||
      cat.conversationId !== null ||
      cat.activity === 'snacking' ||
      cat.activity === 'vomiting'
    )
      return
    if (objective.phase === 'doing') return
    if (objective.kind === 'chase') {
      this.updateChase(cat, objective)
      return
    }
    if (objective.kind === 'laser') {
      return
    }
    if (this.elapsed >= objective.deadline) {
      // Give up politely on an unavailable friend or an occupied spot, not every obstruction.
      if (objective.kind === 'privacy') cat.nextVomitAt = this.elapsed + 15
      cat.objective = null
      cat.cottage = null
      this.startActivity(cat, 'sitting', 3 + this.mindRandom() * 4)
      return
    }
    const friend =
      objective.kind === 'visit'
        ? this.cats.find((other) => other.id === objective.friendId)
        : null
    // No tagging along to the cafe: a busy friend can be visited later.
    if (
      objective.kind === 'visit' &&
      (!friend ||
        friend.cafeCustomer !== null ||
        friend.cafeWorker !== null ||
        friend.cottage !== null)
    ) {
      objective.deadline = this.elapsed
      return
    }
    const onBridge =
      isOnBridgeOrApproach(cat.x, cat.z) ||
      (friend ? isOnBridgeOrApproach(friend.x, friend.z) : false)
    const available =
      friend &&
      !onBridge &&
      friend.conversationId === null &&
      friend.cafeCustomer === null &&
      friend.cafeWorker === null &&
      (friend.activity === 'wandering' ||
        friend.activity === 'sitting' ||
        friend.activity === 'socializing') &&
      friend.objective?.kind !== 'privacy' &&
      !this.isOccupied(friend) &&
      !(
        friend.objective?.kind === 'visit' &&
        friend.objective.friendId !== cat.id
      )
    if (
      friend &&
      available &&
      friend.objective?.kind !== 'visit' &&
      Math.hypot(cat.x - friend.x, cat.z - friend.z) < 7
    ) {
      // A friend within greeting distance can turn and come meet the visitor.
      if (friend.objective)
        friend.schedule.unshift({
          ...friend.objective,
          dueAt: this.elapsed,
          resume: true,
        })
      this.beginObjective(friend, {
        kind: 'visit',
        friendId: cat.id,
        destination: { x: cat.x, z: cat.z },
        hangout: null,
        duration: objective.duration,
      })
    }
    if (
      friend &&
      available &&
      Math.hypot(cat.x - friend.x, cat.z - friend.z) <
        catRadius(cat) + catRadius(friend) + 1.6
    ) {
      // A nearby, available friend accepts the visit and puts their own errand aside.
      const dialogue = this.newDialogue(
        Math.min(cat.id, friend.id),
        Math.ceil(objective.duration / 7),
      )
      if (friend.objective && friend.objective.kind !== 'visit')
        friend.schedule.unshift({
          ...friend.objective,
          dueAt: this.elapsed,
          resume: true,
        })
      for (const [resident, partner] of [
        [cat, friend],
        [friend, cat],
      ]) {
        this.startActivity(resident, 'socializing', objective.duration)
        resident.objective = {
          ...objective,
          phase: 'doing',
          destination: { x: resident.x, z: resident.z },
          friendId: partner.id,
          deadline: this.elapsed + objective.duration,
        }
        resident.socialTarget = partner.id
        resident.dialogue = dialogue
        resident.target = { x: resident.x, z: resident.z }
      }
      return
    }
    const distance = Math.hypot(
      cat.x - objective.destination.x,
      cat.z - objective.destination.z,
    )
    if (
      this.elapsed >= objective.nextRouteAt &&
      (cat.blockedTime > 1.25 ||
        !cat.route.length ||
        (friend &&
          Math.hypot(
            friend.x - objective.destination.x,
            friend.z - objective.destination.z,
          ) > 4.5))
    ) {
      this.routeObjective(cat, cat.blockedTime > 1.25)
      cat.blockedTime = 0
    }
    const next = cat.route[1]
    const toTarget = Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z)
    const radius = CAT_RADIUS * cat.scale + 0.08
    if (
      next &&
      // Close enough, or nudged past it by the crowd with the next leg open.
      (toTarget < 0.8 ||
        (toTarget < 2 &&
          Math.hypot(cat.x - next.x, cat.z - next.z) <
            Math.hypot(cat.target.x - next.x, cat.target.z - next.z))) &&
      clearSegment(cat, next, radius)
    ) {
      cat.route.shift()
      cat.target = cat.route[0]
    } else if (
      next &&
      toTarget < 0.8 &&
      this.elapsed >= objective.nextRouteAt
    ) {
      // Standing at the waypoint, but the next leg grazes scenery from just
      // here: find a way round to it and carry on with the rest of the route.
      objective.nextRouteAt = this.elapsed + 1
      const detour = findRoute(cat, next, radius)
      if (detour.length) {
        cat.route.splice(0, 2, ...detour)
        cat.target = cat.route[0]
      }
    }
    if (
      distance > 0.8 ||
      Math.hypot(cat.velocity.x, cat.velocity.z) > 0.15 ||
      cat.pose.sitting + cat.pose.lying + cat.pose.vomiting > 0.01 ||
      friend
    )
      return
    if (objective.kind === 'picnic') {
      objective.phase = 'doing'
      // Dozing off takes room to stretch out beside the others on the blanket.
      if (
        this.mindRandom() < 0.73 ||
        !this.canOccupy(cat.x, cat.z, EXTENDED_POSE_RADIUS * cat.scale, cat.id)
      )
        this.startActivity(cat, 'sitting', objective.duration)
      else this.startActivity(cat, 'resting', this.napDuration())
      return
    }
    if (objective.kind === 'cottage' && cat.cottage) {
      // At their place in line beside the door, facing it.
      objective.phase = 'doing'
      cat.cottage.stage = 'waiting'
      cat.cottage.since = this.elapsed
      this.cottages[cat.cottage.cottageId].line.push(cat.id)
      cat.target = { x: cat.x, z: cat.z }
      return
    }
    if (objective.kind === 'privacy') {
      const isolated = this.cats.every(
        (other) =>
          other.id === cat.id ||
          Math.hypot(cat.x - other.x, cat.z - other.z) > 5,
      )
      if (
        !isolated ||
        !this.canOccupy(cat.x, cat.z, EXTENDED_POSE_RADIUS * cat.scale, cat.id)
      ) {
        if (this.elapsed >= objective.nextRouteAt) {
          const point = this.privateSpot(cat)
          if (point) objective.destination = point
          this.routeObjective(cat)
        }
        return
      }
      objective.phase = 'doing'
      this.startActivity(cat, 'vomiting', VOMIT_DURATION)
      return
    }
    objective.phase = 'doing'
    const canLie = this.canOccupy(
      cat.x,
      cat.z,
      EXTENDED_POSE_RADIUS * cat.scale,
      cat.id,
    )
    // A napping spot always means a nap; anywhere else they often doze off too.
    if ((objective.kind === 'rest' || this.mindRandom() < 0.3) && canLie)
      this.startActivity(
        cat,
        objective.kind === 'rest' ? 'lying' : 'resting',
        this.napDuration(),
      )
    else this.startActivity(cat, 'sitting', objective.duration)
  }

  private napDuration() {
    return NAP_SECONDS + this.mindRandom() * NAP_SPREAD
  }

  private chooseHangout(cat: Cat): { point: Point; kind: HangoutKind } | null {
    let choice: { point: Point; kind: HangoutKind } | null = null
    let totalWeight = 0
    const radius = catRadius(cat)
    const consider = (point: Point, kind: HangoutKind) => {
      const distance = Math.hypot(point.x - cat.x, point.z - cat.z)
      if (
        distance < 1.2 ||
        distance > 13 ||
        Math.abs(point.x - meadowPathX(point.z)) < 3.1 ||
        isOnCafeTerrace(point.x, point.z, radius) ||
        isInCafeQueueLane(point.x, point.z, radius)
      )
        return
      if (
        !this.canOccupy(point.x, point.z, radius + 0.15, cat.id) ||
        !this.clearApproach(cat, point, radius)
      )
        return
      const crowding = this.hangoutCrowding(point, cat.id)
      if (crowding > 2.8) return
      // A neighbor or two is inviting; several nearby visitors reduce the draw.
      const company =
        (1 + Math.min(crowding, 0.9) * 0.45) /
        (1 + Math.max(0, crowding - 1.2) ** 2 * 3)
      const preference =
        kind === 'shade'
          ? 1.45
          : kind === 'cottage' || kind === 'picnic'
            ? 1.65
            : kind === 'rock'
              ? 1.3
              : 1
      const weight = preference * company * Math.exp(-distance / 10)
      totalWeight += weight
      if (this.random() * totalWeight < weight) choice = { point, kind }
    }
    for (const tree of trees) {
      if (Math.hypot(tree.x - cat.x, tree.z - cat.z) > 16) continue
      for (let i = 0; i < 5; i++) {
        const angle = this.random() * Math.PI * 2
        const distance = tree.radius + radius + 0.4 + this.random() * 0.8
        consider(
          {
            x: tree.x + Math.sin(angle) * distance,
            z: tree.z + Math.cos(angle) * distance,
          },
          'shade',
        )
      }
    }
    for (const house of houses) {
      if (Math.hypot(house.x - cat.x, house.z - cat.z) > 18) continue
      // Extra samples make up for the front, which the doorway keeps clear.
      for (let i = 0; i < 12; i++) {
        const angle = (this.random() - 0.5) * Math.PI * 2
        const distance = house.radius + radius + 0.7 + this.random() * 1.4
        const point = {
          x: house.x + Math.sin(angle) * distance,
          z: house.z + Math.cos(angle) * distance,
        }
        // All the way around, leaving the front door clear.
        if (isInCottageDoorway(point.x, point.z, radius)) continue
        consider(point, 'cottage')
      }
    }
    for (const clearing of clearings) {
      if (Math.hypot(clearing.x - cat.x, clearing.z - cat.z) > 15) continue
      for (let i = 0; i < 4; i++) {
        const angle = this.random() * Math.PI * 2
        const distance = Math.sqrt(this.random()) * 2.6
        consider(
          {
            x: clearing.x + Math.sin(angle) * distance,
            z: clearing.z + Math.cos(angle) * distance,
          },
          'clearing',
        )
      }
    }
    for (const rock of rocks) {
      if (Math.hypot(rock.x - cat.x, rock.z - cat.z) > 16) continue
      for (let i = 0; i < 5; i++) {
        const angle = this.random() * Math.PI * 2
        const distance = rock.radius + radius + 0.3 + this.random() * 0.8
        consider(
          {
            x: rock.x + Math.sin(angle) * distance,
            z: rock.z + Math.cos(angle) * distance,
          },
          'rock',
        )
      }
    }
    for (const blanket of picnicBlankets) {
      if (Math.hypot(blanket.x - cat.x, blanket.z - cat.z) > 16) continue
      for (let i = 0; i < 4; i++)
        consider(blanketSpot(blanket, this.random, 0.5), 'picnic')
    }
    return choice
  }

  dropTreat(point: Point, customPieces?: Point[]) {
    const treat = isWalkable(point.x, point.z) ? { ...point } : { x: 0, z: 3 }
    this.treat = treat
    this.treatUntil = this.elapsed + TREAT_SECONDS
    for (const conversation of [...this.conversations]) {
      if (
        conversation.members.some((id) => {
          const cat = this.cats.find((resident) => resident.id === id)
          return cat && Math.hypot(cat.x - treat.x, cat.z - treat.z) < 20
        })
      )
        this.endConversation(conversation)
    }
    const hungry: Cat[] = []
    for (const cat of this.cats) {
      cat.dialogue = null
      if (
        this.canGoForTreat(cat) &&
        Math.hypot(cat.x - treat.x, cat.z - treat.z) < 20
      )
        hungry.push(cat)
    }
    this.treatNotices = []
    // The handful scatters so every cat has a piece of their own: each lies
    // just inside a place in the rings around where it landed.
    const places =
      customPieces && customPieces.length > 0
        ? this.customTreatPlaces(customPieces)
        : this.treatPlaces(treat, Math.max(hungry.length, 6))
    this.treatPieces = this.treatPieces.filter((piece) => piece.catId !== null)
    const addPiece = (place: { piece: Point; stand: Point; ring: number }) =>
      this.treatPieces.push({
        ...place.piece,
        spot: place.stand,
        ring: place.ring,
        id: this.nextTreatPieceId++,
        catId: null,
      })
    hungry.sort(
      (a, b) =>
        Math.hypot(a.x - treat.x, a.z - treat.z) -
        Math.hypot(b.x - treat.x, b.z - treat.z),
    )
    // The closest cats fill the inner ring first, on their own side, so
    // nobody has to squeeze past a kneeling neighbor.
    for (const cat of hungry) {
      let best: (typeof places)[number] | null = null
      for (const place of places)
        if (
          !place.taken &&
          (!best ||
            place.ring < best.ring ||
            (place.ring === best.ring &&
              Math.hypot(place.stand.x - cat.x, place.stand.z - cat.z) <
                Math.hypot(best.stand.x - cat.x, best.stand.z - cat.z)))
        )
          best = place
      if (!best) continue
      // Across the creek is too far to notice, even as the crow flies.
      const route = this.snackRoute(cat, best.stand)
      let walk = 0
      route.reduce((from, to) => {
        walk += Math.hypot(to.x - from.x, to.z - from.z)
        return to
      }, cat as Point)
      if (walk > 24) continue
      best.taken = true
      // Word spreads outward: farther cats catch on a little later, and
      // everyone takes their own moment to look up.
      addPiece(best)
      this.treatNotices.push({
        catId: cat.id,
        at:
          this.elapsed +
          0.15 +
          Math.hypot(cat.x - treat.x, cat.z - treat.z) * 0.03 +
          this.reactionRandom() * 0.6,
      })
    }
    // A few spare pieces, even when nobody is nearby to notice.
    for (const place of places) {
      if (hungry.length >= 6 || this.treatPieces.length >= 6) break
      if (!place.taken) addPiece(place)
    }
  }

  private canGoForTreat(cat: Cat) {
    return (
      cat.activity !== 'vomiting' &&
      cat.cafeWorker === null &&
      cat.cafeCustomer === null &&
      cat.cottage === null &&
      cat.objective?.kind !== 'privacy' &&
      // Anyone already kneeling over a treat finishes it first.
      cat.snack?.stage !== 'eating'
    )
  }

  // A cat looks up, spots their piece of the treat, and heads for it.
  private noticeTreats() {
    for (const notice of [...this.treatNotices]) {
      if (this.elapsed < notice.at) continue
      this.treatNotices.splice(this.treatNotices.indexOf(notice), 1)
      const cat = this.catById(notice.catId)
      // Busy with something else by now; someone else can have theirs.
      if (!cat || !this.canGoForTreat(cat)) continue
      this.startActivity(cat, 'snacking', 19)
      this.emote(cat, 'treat')
      cat.travelMode = cat.id % 4 === 0 ? 'sprinting' : 'trotting'
      cat.snack = {
        pieceId: -1,
        spot: { x: cat.x, z: cat.z },
        stage: 'approaching',
        since: this.elapsed,
        eatTime: SNACK_EAT_TIME * (0.8 + this.reactionRandom() * 0.4),
        detours: 0,
        rethinkAt: this.elapsed,
        blockedPieceId: null,
      }
      if (!this.choosePiece(cat)) {
        cat.snack = null
        cat.timer = 1
      }
    }
  }

  // Head for a free piece, filling in from the middle: an inner place unless
  // an outer one is much handier, and not one a closer cat is about to take.
  // Nothing is reserved until a cat kneels, so late arrivals settle on the
  // outside rather than squeeze past cats already eating.
  private choosePiece(cat: Cat) {
    const snack = cat.snack!
    snack.rethinkAt = this.elapsed + 0.6 + this.reactionRandom() * 0.6
    const away = (resident: Cat, piece: TreatPiece) =>
      Math.hypot(piece.spot.x - resident.x, piece.spot.z - resident.z)
    let best: TreatPiece | null = null
    let bestScore = Infinity
    for (const piece of this.treatPieces) {
      if (piece.catId !== null) continue
      const distance = away(cat, piece)
      let rivals = 0
      for (const other of this.cats)
        if (
          other !== cat &&
          other.snack?.stage === 'approaching' &&
          other.snack.pieceId === piece.id &&
          away(other, piece) < distance
        )
          rivals++
      // A little loyalty to the current piece keeps cats from dithering.
      const score =
        distance +
        piece.ring * 2.6 +
        rivals * 3 +
        (piece.id === snack.blockedPieceId ? 6 : 0) -
        (piece.id === snack.pieceId ? 0.5 : 0)
      if (score < bestScore) {
        best = piece
        bestScore = score
      }
    }
    if (best && best.id !== snack.pieceId) {
      snack.pieceId = best.id
      snack.spot = best.spot
      this.routeSnack(cat)
    }
    return best
  }

  private customTreatPlaces(customPieces: Point[]): {
    stand: Point
    piece: Point
    ring: number
    taken: boolean
  }[] {
    const places: {
      stand: Point
      piece: Point
      ring: number
      taken: boolean
    }[] = []
    const radius = CAT_RADIUS * 1.1
    const candidateAngles = [0, 1.57, 3.14, 4.71, 0.78, 2.35, 3.92, 5.49]
    for (let i = 0; i < customPieces.length; i++) {
      const piece = customPieces[i]
      let stand: Point = { x: piece.x, z: piece.z }
      for (const angle of candidateAngles) {
        const candidateStand = {
          x: piece.x + Math.sin(angle) * SNACK_REACH,
          z: piece.z + Math.cos(angle) * SNACK_REACH,
        }
        if (
          isWalkable(candidateStand.x, candidateStand.z, radius) &&
          !isOnCafeTerrace(candidateStand.x, candidateStand.z, radius) &&
          !isInCafeQueueLane(candidateStand.x, candidateStand.z, radius) &&
          !isInCottageDoorway(candidateStand.x, candidateStand.z, radius)
        ) {
          stand = candidateStand
          break
        }
      }
      places.push({ stand, piece, ring: i, taken: false })
    }
    return places
  }

  // Places to kneel in rings around a dropped treat, spaced for company.
  private treatPlaces(center: Point, count: number) {
    const places: {
      stand: Point
      piece: Point
      ring: number
      taken: boolean
    }[] = []
    const radius = CAT_RADIUS * 1.1
    for (let ring = 0; ring < 8 && places.length < count; ring++) {
      const distance = 1.9 + ring * 2.6
      const slots = Math.floor((Math.PI * 2 * distance) / 2.6)
      for (let slot = 0; slot < slots; slot++) {
        const angle = ((slot + ring * 0.5) / slots) * Math.PI * 2
        const along = (reach: number) => ({
          x: center.x + Math.sin(angle) * reach,
          z: center.z + Math.cos(angle) * reach,
        })
        const stand = along(distance)
        const piece = along(distance - SNACK_REACH)
        if (
          isWalkable(stand.x, stand.z, radius) &&
          isWalkable(piece.x, piece.z) &&
          !isOnCafeTerrace(stand.x, stand.z, radius) &&
          !isInCafeQueueLane(stand.x, stand.z, radius) &&
          !isInCottageDoorway(stand.x, stand.z, radius)
        )
          places.push({ stand, piece, ring, taken: false })
      }
    }
    return places
  }

  // Around trees and cottages to a place beside the treat, and around
  // residents in the way after a hold-up.
  private routeSnack(cat: Cat, avoidResidents = false) {
    cat.route = this.snackRoute(cat, cat.snack!.spot, avoidResidents)
    cat.target = cat.route[0]
  }

  private snackRoute(cat: Cat, spot: Point, avoidResidents = false) {
    const blockers = avoidResidents
      ? this.cats
          .filter(
            (other) =>
              other.id !== cat.id &&
              Math.hypot(other.x - cat.x, other.z - cat.z) >
                catRadius(other) + CAT_RADIUS * cat.scale + 0.3,
          )
          .map((other) => ({
            x: other.x,
            z: other.z,
            radius: catRadius(other) + 0.08,
          }))
      : []
    let route = findRoute(cat, spot, CAT_RADIUS * cat.scale + 0.08, blockers)
    if (!route.length)
      route = findRoute(cat, spot, CAT_RADIUS * cat.scale, blockers)
    return route.length ? route : [{ ...spot }]
  }

  // Walk up to the treat, kneel, pick it up, and enjoy it.
  private updateSnack(cat: Cat) {
    const snack = cat.snack
    if (!snack || cat.activity !== 'snacking') return
    const index = this.treatPieces.findIndex(
      (piece) => piece.id === snack.pieceId,
    )
    let piece: TreatPiece | null = this.treatPieces[index] ?? null
    if (snack.stage === 'approaching') {
      if (!piece || piece.catId !== null || this.elapsed >= snack.rethinkAt)
        piece = this.choosePiece(cat)
      if (!piece) {
        // Every last piece is spoken for, or swept away with the leftovers.
        cat.snack = null
        cat.timer = Math.min(cat.timer, 1)
        return
      }
      if (cat.blockedTime > 1.25) {
        snack.detours++
        cat.blockedTime = 0
        // Walled off by the crowd? Maybe another piece is easier to reach.
        if (snack.detours % 2 === 0) {
          snack.blockedPieceId = snack.pieceId
          piece = this.choosePiece(cat) ?? piece
        }
        this.routeSnack(cat, true)
      }
      if (snack.detours > 5 || this.elapsed - snack.since > TREAT_SECONDS) {
        // Crowded out; someone else can have it.
        cat.snack = null
        cat.timer = Math.min(cat.timer, 1)
        return
      }
      if (
        cat.route.length > 1 &&
        Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z) < 0.8 &&
        clearSegment(cat, cat.route[1], CAT_RADIUS * cat.scale + 0.08)
      ) {
        cat.route.shift()
        cat.target = cat.route[0]
      }
      if (
        Math.hypot(cat.velocity.x, cat.velocity.z) > 0.15 ||
        cat.pose.sitting + cat.pose.lying + cat.pose.vomiting > 0.01
      )
        return
      // Stopped within reach of their piece, or of any other free one.
      const reach = (p: TreatPiece) => Math.hypot(p.x - cat.x, p.z - cat.z)
      if (reach(piece) > SNACK_REACH + 0.6) {
        const handy = this.treatPieces.find(
          (p) => p.catId === null && reach(p) <= SNACK_REACH + 0.6,
        )
        if (!handy) return
        piece = handy
        snack.pieceId = piece.id
        snack.spot = piece.spot
      }
      // Right on top of it there's no need to turn around first.
      const facing = Math.cos(
        Math.atan2(piece.x - cat.x, piece.z - cat.z) - cat.heading,
      )
      if (reach(piece) > 0.5 && facing < 0.9) return
      piece.catId = cat.id
      snack.stage = 'eating'
      snack.since = this.elapsed
      cat.target = { x: cat.x, z: cat.z }
      cat.timer = Math.max(cat.timer, snack.eatTime + 0.5)
      return
    }
    if (snack.stage !== 'eating') return
    const time = this.elapsed - snack.since
    // Now it's in their paws rather than on the grass.
    if (piece && time >= SNACK_PICKUP_TIME) this.treatPieces.splice(index, 1)
    if (time < snack.eatTime) return
    snack.stage = 'done'
    this.emote(cat, 'yum')
    // Savor it for a moment before getting back to the day.
    cat.timer = 1.6 + this.reactionRandom() * 1.8
  }

  step(delta: number) {
    const dt = Math.min(Math.max(delta, 0), 0.1)
    if (dt === 0) return
    this.elapsed += dt
    if (this.treat && this.elapsed > this.treatUntil) this.treat = null
    // Leftovers vanish with the treat, except those a cat is still going for.
    if (!this.treat && this.treatPieces.length)
      this.treatPieces = this.treatPieces.filter(
        (piece) =>
          piece.catId !== null ||
          this.cats.some(
            (cat) =>
              cat.snack?.stage === 'approaching' &&
              cat.snack.pieceId === piece.id,
          ),
      )
    this.noticeTreats()
    this.updateConversations()
    this.updateCafe(dt)
    this.updateButterflies(dt)
    this.updateCottages()
    this.updatePicnicTrips()
    this.updateLaser()
    for (const cat of this.cats) {
      const previousActivityTime = cat.activityTime
      cat.activityTime += dt
      if (cat.emote && this.elapsed - cat.emoteAt >= EMOTE_SECONDS[cat.emote])
        cat.emote = null
      if (isIndoors(cat)) {
        this.walkDoorway(cat, dt)
        continue
      }
      if (
        cat.activity === 'vomiting' &&
        previousActivityTime < VOMIT_EMIT_TIME &&
        cat.activityTime >= VOMIT_EMIT_TIME
      ) {
        if (this.puddles.length === MAX_PUDDLES) this.puddles.shift()
        this.puddles.push({
          x: cat.x + Math.sin(cat.heading) * 0.92 * cat.scale,
          z: cat.z + Math.cos(cat.heading) * 0.92 * cat.scale,
          heading: cat.heading,
          scale: cat.scale,
          createdAt: this.elapsed,
        })
      }
      if (
        cat.cafeWorker === null &&
        cat.objective &&
        cat.objective.kind !== 'privacy' &&
        cat.objective.kind !== 'chase' &&
        cat.objective.kind !== 'cottage' &&
        cat.conversationId === null &&
        this.elapsed >= cat.nextVomitAt &&
        ['wandering', 'socializing', 'sitting'].includes(cat.activity)
      ) {
        const point = this.privateSpot(cat)
        if (point) {
          cat.schedule.unshift({
            ...cat.objective,
            dueAt: this.elapsed,
            resume: true,
          })
          this.beginObjective(cat, {
            kind: 'privacy',
            destination: point,
            hangout: null,
            friendId: null,
            duration: VOMIT_DURATION,
          })
          this.emote(cat, 'queasy')
        } else cat.nextVomitAt = this.elapsed + 10
      }
      if (cat.cafeWorker === null) {
        this.updateObjective(cat)
      }
      this.updateSnack(cat)
      if (
        cat.cafeWorker === null &&
        cat.cafeCustomer === null &&
        cat.conversationId === null &&
        cat.cottage === null &&
        !(cat.objective?.phase === 'traveling' && cat.activity !== 'snacking')
      ) {
        cat.timer -= dt
        if (cat.timer <= 0) this.chooseActivity(cat)
      }
      const conversation = this.conversations.find(
        (group) => group.id === cat.conversationId,
      )
      const partner =
        cat.objective?.kind === 'visit' &&
        cat.objective.phase === 'doing' &&
        cat.activity === 'socializing'
          ? this.cats.find(
              (other) =>
                other.id === cat.socialTarget &&
                other.activity === 'socializing' &&
                other.socialTarget === cat.id,
            )
          : null
      if (
        cat.objective?.kind === 'visit' &&
        cat.objective.phase === 'doing' &&
        cat.activity === 'socializing' &&
        !partner
      )
        cat.timer = Math.min(cat.timer, 0.2)
      const discussion =
        cat.conversationPhase === 'discussing' ||
        partner ||
        this.isOrderChat(cat)
          ? 1
          : 0
      if (partner && cat.dialogue) {
        cat.dialogue.turn = Math.floor(
          (this.elapsed - cat.dialogue.startedAt) / 7,
        )
        cat.dialogue.speakerId =
          cat.dialogue.turn % 2 === 0
            ? Math.min(cat.id, partner.id)
            : Math.max(cat.id, partner.id)
      }
      if (!discussion) cat.dialogue = null
      const speaking = discussion && cat.dialogue?.speakerId === cat.id ? 1 : 0
      const chatBlend = 1 - Math.exp(-dt * 5)
      cat.discussion += (discussion - cat.discussion) * chatBlend
      cat.speaking += (speaking - cat.speaking) * chatBlend
      const targets = {
        sitting: cat.activity === 'sitting' ? 1 : 0,
        lying: cat.activity === 'lying' || cat.activity === 'resting' ? 1 : 0,
        vomiting: cat.activity === 'vomiting' ? 1 : 0,
      }
      for (const key of ['sitting', 'lying', 'vomiting'] as const) {
        const difference = targets[key] - cat.pose[key]
        cat.pose[key] +=
          Math.sign(difference) * Math.min(Math.abs(difference), dt * 1.8)
      }
      const kneeling = cat.snack?.stage === 'eating' ? 1 : 0
      cat.kneel +=
        Math.sign(kneeling - cat.kneel) *
        Math.min(Math.abs(kneeling - cat.kneel), dt * 2.2)
      const dx = cat.target.x - cat.x
      const dz = cat.target.z - cat.z
      const distance = Math.hypot(dx, dz)
      const passing =
        (cat.objective?.phase === 'traveling' ||
          cat.cafeCustomer !== null ||
          cat.cafeWorker !== null) &&
        cat.route.length > 1
      const moving =
        (cat.activity === 'wandering' ||
          cat.activity === 'snacking' ||
          cat.activity === 'socializing' ||
          cat.activity === 'working' ||
          (cat.activity === 'conversing' &&
            cat.conversationPhase === 'gathering')) &&
        distance > (passing ? 0.08 : 0.4) &&
        cat.pose.sitting + cat.pose.lying + cat.pose.vomiting < 0.01 &&
        cat.kneel < 0.01 &&
        !this.isStartled(cat)
      const speed = TRAVEL_SPEEDS[cat.travelMode] * cat.pace
      let traveled = 0
      let turnTarget = cat.heading
      if (moving) {
        const arrival = passing
          ? Math.min(1, distance / 0.8)
          : Math.min(1, (distance - 0.4) / Math.max(1.2, speed * 0.65))
        let vx = (dx / distance) * arrival
        let vz = (dz / distance) * arrival
        const giveWay =
          !isOnBridgeDeck(cat) && isOnBridgeOrApproach(cat.x, cat.z, 2)
            ? this.bridgeRightOfWay(cat, dx / distance, dz / distance)
            : null
        if (giveWay) {
          vx = giveWay.x
          vz = giveWay.z
        }
        // Out on an errand, not closing in on a treat or a spot in a group.
        const errand =
          cat.objective?.phase === 'traveling' &&
          cat.snack === null &&
          cat.cafeCustomer === null &&
          cat.conversationId === null
        const gx = dx / distance,
          gz = dz / distance
        for (const other of this.cats) {
          if (other.id === cat.id || sharesSpace(cat, other)) continue
          const ox = cat.x - other.x,
            oz = cat.z - other.z
          const d = Math.hypot(ox, oz)
          // Customers stand close together in line.
          const inLine =
            this.cafeQueue.includes(cat.id) && this.cafeQueue.includes(other.id)
          const touching = bodyRadius(cat) + bodyRadius(other)
          const personalSpace = touching + (inLine ? 0.08 : 0.4)
          if (d < personalSpace && d > 0.01) {
            const push = (personalSpace - d) * 1.9
            vx += (ox / d) * push
            vz += (oz / d) * push
          }
          // Someone coming the other way, or standing in the way once they've
          // held us up: veer off to the side they're already on, or to the
          // same hand the bridge lanes keep when dead ahead, so both pass
          // instead of pushing head to head.
          const ahead = -(ox * gx + oz * gz)
          const offset = oz * gx - ox * gz
          const along = other.velocity.x * gx + other.velocity.z * gz
          const still = Math.hypot(other.velocity.x, other.velocity.z) < 0.1
          if (
            errand &&
            ahead > 0 &&
            d < personalSpace + 1.2 &&
            Math.abs(offset) < touching + 0.3 &&
            (along < -0.1 || (still && cat.blockedTime > 0.5))
          ) {
            const veer =
              (offset > 0.3 ? -0.8 : 0.8) *
              Math.min(1, 1 - (d - touching) / (personalSpace + 1.2 - touching))
            vx += gz * veer
            vz -= gx * veer
          }
        }
        for (const o of obstacles) {
          const ox = cat.x - o.x,
            oz = cat.z - o.z,
            d = Math.hypot(ox, oz)
          // Small cafe props: keep a narrow buffer beyond the body, never contact.
          const avoidanceMargin = cafeObstacles.includes(o)
            ? bodyRadius(cat) + 0.3
            : 1.7
          if (d < o.radius + avoidanceMargin && d > 0.01) {
            vx += (ox / d) * (o.radius + avoidanceMargin - d) * 2.5
            vz += (oz / d) * (o.radius + avoidanceMargin - d) * 2.5
          }
        }
        const length = Math.hypot(vx, vz)
        // At an avoidance equilibrium, tiny forces must stay tiny. Normalizing
        // them to full speed makes neighbors bounce in opposite directions.
        const alignment =
          0.25 + 0.75 * Math.max(0, Math.cos(Math.atan2(vx, vz) - cat.heading))
        const gain =
          length < 0.06 ? 0 : (speed * alignment) / Math.max(1, length)
        const response = 1 - Math.exp(-dt * 6)
        cat.velocity.x += (vx * gain - cat.velocity.x) * response
        cat.velocity.z += (vz * gain - cat.velocity.z) * response
        if (gain === 0 && Math.hypot(cat.velocity.x, cat.velocity.z) < 0.04) {
          cat.velocity.x = 0
          cat.velocity.z = 0
        }
        const x = cat.x + cat.velocity.x * dt,
          z = cat.z + cat.velocity.z * dt
        // Reject penetration after steering, including into stationary cats.
        // Sequential updates reserve each accepted position for later residents.
        // A glancing blow slides along whatever is in the way, rail or
        // neighbor, rather than pinning the cat there for good. Walking
        // squarely into something still stops them.
        const stride = Math.hypot(x - cat.x, z - cat.z)
        const step = (
          Math.abs(cat.velocity.x) > Math.abs(cat.velocity.z)
            ? [
                { x, z },
                { x, z: cat.z },
                { x: cat.x, z },
              ]
            : [
                { x, z },
                { x: cat.x, z },
                { x, z: cat.z },
              ]
        ).find(
          (point, index) =>
            (index === 0 ||
              Math.hypot(point.x - cat.x, point.z - cat.z) > stride * 0.25) &&
            this.canMove(cat, point.x, point.z),
        )
        if (step) {
          traveled = Math.hypot(step.x - cat.x, step.z - cat.z)
          cat.velocity.x = (step.x - cat.x) / dt
          cat.velocity.z = (step.z - cat.z) / dt
          cat.x = step.x
          cat.z = step.z
        } else {
          cat.velocity.x = 0
          cat.velocity.z = 0
        }
        if (traveled / dt > 0.12)
          turnTarget = Math.atan2(cat.velocity.x, cat.velocity.z)
        cat.blockedTime = traveled / dt < 0.08 ? cat.blockedTime + dt : 0
        // Let a brief obstruction clear before choosing a new activity/route.
        if (
          cat.blockedTime > 1.25 &&
          cat.activity === 'wandering' &&
          !cat.objective
        )
          cat.timer = 0
      } else {
        cat.velocity.x = 0
        cat.velocity.z = 0
        cat.blockedTime = 0
        if (cat.activity === 'wandering') cat.timer = Math.min(cat.timer, 1)
      }
      if (cat.socialTarget !== null && traveled / dt < 0.12) {
        const friend = this.cats.find((other) => other.id === cat.socialTarget)
        if (friend) turnTarget = Math.atan2(friend.x - cat.x, friend.z - cat.z)
      }
      const butterfly =
        cat.butterflyId === null ? null : this.butterflies[cat.butterflyId]
      if (butterfly && traveled / dt < 0.12)
        turnTarget = Math.atan2(butterfly.x - cat.x, butterfly.z - cat.z)
      const piece =
        cat.snack?.stage === 'approaching' && cat.activity === 'snacking'
          ? this.treatPieces.find((p) => p.id === cat.snack!.pieceId)
          : undefined
      if (piece && traveled / dt < 0.12)
        turnTarget = Math.atan2(piece.x - cat.x, piece.z - cat.z)
      if (cat.cottage?.stage === 'waiting' && traveled / dt < 0.12) {
        const door = cottageDoorway(this.cottages[cat.cottage.cottageId]).door
        turnTarget = Math.atan2(door.x - cat.x, door.z - cat.z)
      }
      if (conversation && traveled / dt < 0.12)
        turnTarget = Math.atan2(
          conversation.center.x - cat.x,
          conversation.center.z - cat.z,
        )
      const cafeFacing =
        cat.cafeCustomer?.facing ?? cat.cafeWorker?.facing ?? null
      if (cafeFacing !== null && traveled / dt < 0.12) turnTarget = cafeFacing
      this.turnToward(cat, turnTarget, dt)
      // Feet and bobbing follow accepted movement, including slowing and yielding.
      const walking = Math.min(1, traveled / (dt * speed))
      cat.walking += (walking - cat.walking) * (1 - Math.exp(-dt * 8))
      cat.travelSpeed +=
        (traveled / dt - cat.travelSpeed) * (1 - Math.exp(-dt * 7))
      cat.gait += traveled * (5 - Math.min(1.4, cat.travelSpeed * 0.32))
    }
  }

  // Whoever is already out on the deck has right of way. Anyone at the ends
  // standing in their path, rather than heading the same way, steps aside
  // and back instead of pressing in.
  private bridgeRightOfWay(cat: Cat, headingX: number, headingZ: number) {
    for (const other of this.cats) {
      if (other.id === cat.id || !isOnBridgeDeck(other)) continue
      const length = Math.hypot(
        other.target.x - other.x,
        other.target.z - other.z,
      )
      if (length < 0.1) continue
      const ux = (other.target.x - other.x) / length,
        uz = (other.target.z - other.z) / length
      if (headingX * ux + headingZ * uz > 0.5) continue
      const ox = cat.x - other.x,
        oz = cat.z - other.z
      const ahead = ox * ux + oz * uz
      const side = ox * uz - oz * ux
      if (
        ahead <= 0 ||
        ahead > 4 ||
        Math.abs(side) > catRadius(cat) + catRadius(other) + 0.3
      )
        continue
      const away = side < 0 ? -1 : 1
      return {
        x: uz * away * 0.8 + ux * 0.4,
        z: -ux * away * 0.8 + uz * 0.4,
      }
    }
    return null
  }

  private newDialogue(speakerId: number, turns: number) {
    return createDialogue(
      this.nextDialogueId++,
      speakerId,
      this.elapsed,
      this.dialogueRandom,
      this.dialogueMemory,
      turns,
    )
  }

  revealDialogue(catId: number) {
    const dialogue = this.cats.find((cat) => cat.id === catId)?.dialogue
    if (dialogue) dialogue.expanded = true
  }

  toggleDialogue(catId: number) {
    const dialogue = this.cats.find((cat) => cat.id === catId)?.dialogue
    if (dialogue) dialogue.expanded = !dialogue.expanded
  }

  private updateConversations() {
    for (const conversation of [...this.conversations]) {
      const members = conversation.members.map((id) =>
        this.cats.find((cat) => cat.id === id),
      )
      if (
        members.some((cat) => !cat || cat.conversationId !== conversation.id) ||
        this.elapsed >= conversation.deadline
      ) {
        this.endConversation(conversation)
        continue
      }
      if (conversation.phase === 'gathering') {
        const arrived = members.every(
          (cat) =>
            cat &&
            Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z) < 0.7 &&
            Math.hypot(cat.velocity.x, cat.velocity.z) < 0.13 &&
            cat.pose.sitting + cat.pose.lying + cat.pose.vomiting < 0.01,
        )
        if (!arrived) continue
        conversation.phase = 'discussing'
        conversation.deadline =
          this.elapsed + 44 + this.conversationRandom() * 24
        conversation.speaker =
          conversation.members[
            Math.floor(this.conversationRandom() * members.length)
          ]
        conversation.nextTurnAt =
          this.elapsed + 6 + this.conversationRandom() * 4
        conversation.dialogue = this.newDialogue(
          conversation.speaker,
          Math.ceil((conversation.deadline - this.elapsed) / 8),
        )
        for (const cat of members)
          if (cat) {
            cat.conversationPhase = 'discussing'
            cat.dialogue = conversation.dialogue
            cat.target = { x: cat.x, z: cat.z }
          }
      } else if (this.elapsed >= conversation.nextTurnAt) {
        const next =
          (conversation.members.indexOf(conversation.speaker!) + 1) %
          members.length
        conversation.speaker = conversation.members[next]
        if (conversation.dialogue) {
          conversation.dialogue.turn++
          conversation.dialogue.speakerId = conversation.speaker
        }
        conversation.nextTurnAt =
          this.elapsed + 6 + this.conversationRandom() * 4
      }
    }
    if (
      this.conversations.length === 0 &&
      this.elapsed >= this.nextConversationAt
    ) {
      // Only one gathering at a time; failed invitations also wait before retrying.
      this.nextConversationAt =
        this.elapsed + 25 + this.conversationRandom() * 20
      if (!this.treat) this.tryConversation()
    }
  }

  private tryConversation() {
    const eligible = this.cats.filter(
      (cat) =>
        !isOnBridgeOrApproach(cat.x, cat.z) &&
        cat.cafeWorker === null &&
        cat.cafeCustomer === null &&
        cat.conversationId === null &&
        cat.objective?.kind !== 'privacy' &&
        cat.objective?.kind !== 'visit' &&
        !this.isOccupied(cat) &&
        (cat.activity === 'wandering' ||
          cat.activity === 'socializing' ||
          cat.activity === 'sitting'),
    )
    if (eligible.length < 2) return
    const desiredSize = 2 + Math.floor(this.conversationRandom() * 4)
    for (let attempt = 0; attempt < 16; attempt++) {
      const host =
        eligible[Math.floor(this.conversationRandom() * eligible.length)]
      const members = eligible
        .filter((cat) => Math.hypot(cat.x - host.x, cat.z - host.z) < 8)
        .sort(
          (a, b) =>
            Math.hypot(a.x - host.x, a.z - host.z) -
            Math.hypot(b.x - host.x, b.z - host.z),
        )
        .slice(0, desiredSize)
      if (members.length < 2) continue
      const center = {
        x: members.reduce((sum, cat) => sum + cat.x, 0) / members.length,
        z: members.reduce((sum, cat) => sum + cat.z, 0) / members.length,
      }
      const radius = Math.max(
        1.9,
        (Math.max(...members.map(catRadius)) * 2 + 1.5) /
          (2 * Math.sin(Math.PI / members.length)),
      )
      if (
        isOnBridgeOrApproach(center.x, center.z, radius + BRIDGE_KEEP_CLEAR) ||
        !isWalkable(center.x, center.z, radius + 1.3) ||
        isOnCafeTerrace(center.x, center.z, radius + 1) ||
        isInCottageDoorway(center.x, center.z, radius + 1)
      )
        continue
      // A conversation needs a quiet pocket, not a ring around an existing crowd.
      if (
        this.cats.filter(
          (cat) =>
            !members.includes(cat) &&
            Math.hypot(cat.x - center.x, cat.z - center.z) < radius + 2,
        ).length > 2
      )
        continue
      // Assign spots in angular order so neighbors don't trade places through the circle.
      members.sort(
        (a, b) =>
          Math.atan2(a.x - center.x, a.z - center.z) -
          Math.atan2(b.x - center.x, b.z - center.z),
      )
      const angle = Math.atan2(members[0].x - center.x, members[0].z - center.z)
      const spots = members.map((_, index) => ({
        x:
          center.x +
          Math.sin(angle + (index * Math.PI * 2) / members.length) * radius,
        z:
          center.z +
          Math.cos(angle + (index * Math.PI * 2) / members.length) * radius,
      }))
      const clear = members.every((cat, index) => {
        const spot = spots[index]
        if (
          this.cats.some(
            (other) =>
              !members.includes(other) &&
              Math.hypot(spot.x - other.x, spot.z - other.z) <
                catRadius(cat) + catRadius(other) + 0.5,
          )
        )
          return false
        // Prefer a direct, clear approach. Dynamic blockers still use normal avoidance.
        const steps = Math.ceil(
          Math.hypot(spot.x - cat.x, spot.z - cat.z) / 0.5,
        )
        for (let step = 0; step <= steps; step++) {
          const t = steps ? step / steps : 1
          if (
            !isWalkable(
              cat.x + (spot.x - cat.x) * t,
              cat.z + (spot.z - cat.z) * t,
              catRadius(cat) + 0.1,
            )
          )
            return false
        }
        return true
      })
      if (!clear) continue
      const conversation: Conversation = {
        id: this.nextConversationId++,
        members: members.map((cat) => cat.id),
        center,
        phase: 'gathering',
        deadline: this.elapsed + 18,
        speaker: null,
        nextTurnAt: Infinity,
        dialogue: null,
      }
      this.conversations.push(conversation)
      for (const [index, cat] of members.entries()) {
        this.startActivity(cat, 'conversing', 0)
        cat.conversationId = conversation.id
        cat.conversationPhase = 'gathering'
        cat.target = spots[index]
      }
      return
    }
  }

  private endConversation(conversation: Conversation) {
    this.conversations.splice(this.conversations.indexOf(conversation), 1)
    this.nextConversationAt = this.elapsed + 90 + this.conversationRandom() * 60
    for (const id of conversation.members) {
      const cat = this.cats.find((resident) => resident.id === id)
      if (!cat || cat.conversationId !== conversation.id) continue
      this.startActivity(cat, 'wandering', 7 + this.random() * 5)
      if (cat.objective) {
        cat.schedule.unshift({
          ...cat.objective,
          dueAt: this.elapsed,
          resume: true,
        })
        cat.objective = null
      }
      const angle = Math.atan2(
        cat.x - conversation.center.x,
        cat.z - conversation.center.z,
      )
      const distance = 3 + this.random() * 3
      const target = {
        x: cat.x + Math.sin(angle) * distance,
        z: cat.z + Math.cos(angle) * distance,
      }
      cat.target =
        isWalkable(target.x, target.z, catRadius(cat)) &&
        !isInsideCafeProp(target.x, target.z, 0.2) &&
        !isInCafeQueueLane(target.x, target.z)
          ? target
          : this.point(
              WORLD.minX,
              WORLD.maxX,
              WORLD.minZ,
              WORLD.maxZ,
              catRadius(cat),
              cat.id,
            )
    }
  }

  private turnToward(cat: Cat, target: number, dt: number) {
    let difference = Math.atan2(
      Math.sin(target - cat.heading),
      Math.cos(target - cat.heading),
    )
    // A target almost directly behind can cross the +/-pi seam every frame.
    // Keep the turn's established direction until that ambiguity has passed.
    if (
      Math.abs(difference) > Math.PI * 0.8 &&
      Math.abs(cat.angularVelocity) > 0.1 &&
      difference * cat.angularVelocity < 0
    )
      difference =
        Math.sign(cat.angularVelocity) * (Math.PI * 2 - Math.abs(difference))
    const acceleration = Math.max(
      -MAX_TURN_ACCELERATION,
      Math.min(
        MAX_TURN_ACCELERATION,
        difference * 16 - cat.angularVelocity * 8,
      ),
    )
    cat.angularVelocity = Math.max(
      -MAX_TURN_SPEED,
      Math.min(MAX_TURN_SPEED, cat.angularVelocity + acceleration * dt),
    )
    cat.heading += cat.angularVelocity * dt
  }

  private emote(cat: Cat, kind: EmoteKind) {
    cat.emote = kind
    cat.emoteAt = this.elapsed
  }

  // Still frozen with surprise, before acting on what they noticed.
  private isStartled(cat: Cat) {
    // Some cats are quicker on the uptake than others.
    const pause = STARTLE_SECONDS * (0.7 + 0.6 * ((cat.phase * 7.13) % 1))
    return (
      cat.emote !== null &&
      cat.emote !== 'yum' &&
      this.elapsed - cat.emoteAt < pause
    )
  }

  private startActivity(cat: Cat, activity: Activity, duration: number) {
    // The bridge is never a place to stop: anyone about to sit or doze off
    // there moves along first and settles somewhere off the crossing.
    if (
      (activity === 'sitting' ||
        activity === 'resting' ||
        activity === 'lying') &&
      isOnBridgeOrApproach(cat.x, cat.z)
    ) {
      activity = 'wandering'
      duration = Math.min(duration, 0.5)
    }
    cat.activity = activity
    cat.activityTime = 0
    cat.timer = duration
    cat.blockedTime = 0
    cat.socialTarget = null
    cat.conversationId = null
    cat.conversationPhase = null
    cat.dialogue = null
    cat.hangout = null
    cat.butterflyId = null
    cat.snack = null
    cat.route = []
    if (activity === 'conversing') cat.travelMode = 'walking'
    if (
      activity === 'resting' ||
      activity === 'sitting' ||
      activity === 'lying' ||
      activity === 'vomiting'
    )
      cat.target = { x: cat.x, z: cat.z }
  }

  private chooseActivity(cat: Cat) {
    if (cat.cafeWorker !== null || cat.cafeCustomer !== null) return
    if (cat.activity === 'vomiting') {
      cat.nextVomitAt = this.elapsed + 150 + this.mindRandom() * 150
      cat.objective = null
      this.startActivity(cat, 'resting', 5 + this.random() * 3)
      return
    }
    if (
      cat.objective &&
      cat.objective.kind !== 'chase' &&
      (cat.activity === 'snacking' || cat.objective.phase === 'traveling')
    ) {
      this.resumeObjective(cat)
      return
    }
    const previousObjective = cat.objective
    cat.objective = null
    const isEastResident = cat.id >= 85
    const westVisitors = this.cats.filter((c) => c.id < 85 && c.x > 24).length
    const shouldReturnWest =
      !isEastResident &&
      cat.x > 24 &&
      (previousObjective?.kind === 'picnic'
        ? this.mindRandom() < 0.65
        : westVisitors > 4 || this.mindRandom() < 0.3)
    if (shouldReturnWest) {
      this.picnicReturnAt.set(
        cat.id,
        this.elapsed + 60 + this.mindRandom() * 60,
      )
      const westDest = this.point(
        WORLD.minX,
        14,
        WORLD.minZ,
        WORLD.maxZ,
        catRadius(cat),
        cat.id,
      )
      this.beginObjective(cat, {
        kind: 'explore',
        destination: westDest,
        hangout: null,
        friendId: null,
        duration: 15 + this.mindRandom() * 15,
      })
      return
    }
    if (this.elapsed >= cat.nextVomitAt) {
      const point = this.privateSpot(cat)
      if (point) {
        this.beginObjective(cat, {
          kind: 'privacy',
          destination: point,
          hangout: null,
          friendId: null,
          duration: VOMIT_DURATION,
        })
        this.emote(cat, 'queasy')
        return
      }
      cat.nextVomitAt = this.elapsed + 10
    }
    this.fillSchedule(cat)
    if (cat.schedule[0].dueAt <= this.elapsed + 8) {
      const appointment = cat.schedule.shift()!
      if (appointment.kind === 'explore' && !appointment.resume) {
        const hangout = this.chooseHangout(cat)
        if (hangout) {
          appointment.destination = hangout.point
          appointment.hangout = hangout.kind
        }
      }
      this.beginObjective(cat, appointment)
      this.fillSchedule(cat)
      return
    }
    // Free time between appointments still has a destination and time to enjoy it.
    const hangout = this.chooseHangout(cat)
    const isEast = isEastResident || cat.x > 24
    const minX = isEast ? 27.5 : WORLD.minX
    const maxX = isEast ? WORLD.maxX : 14
    this.beginObjective(cat, {
      kind: 'explore',
      destination:
        hangout?.point ??
        this.point(
          Math.max(minX, cat.x - 8),
          Math.min(maxX, cat.x + 8),
          Math.max(WORLD.minZ, cat.z - 8),
          Math.min(WORLD.maxZ, cat.z + 8),
          catRadius(cat),
          cat.id,
        ),
      hangout: hangout?.kind ?? null,
      friendId: null,
      duration: 12 + this.mindRandom() * 16,
    })
  }

  private updateButterflies(dt: number) {
    for (const butterfly of this.butterflies) {
      const chaser = this.catById(butterfly.chaserId)
      if (
        chaser?.objective?.kind !== 'chase' ||
        chaser.butterflyId !== butterfly.id
      )
        butterfly.chaserId = null
      stepButterfly(
        butterfly,
        dt,
        this.butterflyThreat(butterfly),
        this.butterflyRandom,
      )
      if (
        butterfly.chaserId !== null ||
        butterfly.startled > 0 ||
        this.treat ||
        this.elapsed < butterfly.nextTemptAt
      )
        continue
      butterfly.nextTemptAt = this.elapsed + 16 + this.butterflyRandom() * 26
      // A lazy flutter past a curious cat is hard to resist.
      let nearest: Cat | null = null
      let best = 7.2
      for (const cat of this.cats) {
        const distance = Math.hypot(cat.x - butterfly.x, cat.z - butterfly.z)
        if (distance < best && this.canChase(cat)) {
          nearest = cat
          best = distance
        }
      }
      if (nearest && this.butterflyRandom() < 0.75)
        this.beginChase(nearest, butterfly)
    }
  }

  // The nearest cat close enough to spook a butterfly: its chaser breaking into
  // a run, anyone dashing past, or anyone stepping right up to it.
  private butterflyThreat(butterfly: Butterfly) {
    let threat: Cat | null = null
    let nearest = 2.6
    for (const cat of this.cats) {
      const distance = Math.hypot(cat.x - butterfly.x, cat.z - butterfly.z)
      if (distance >= nearest) continue
      if (
        (cat.id === butterfly.chaserId && cat.travelMode !== 'walking') ||
        (cat.travelSpeed > 1.8 && distance < 1.8) ||
        (distance < 1.3 && (butterfly.perched > 0 || cat.travelSpeed > 0.4))
      ) {
        threat = cat
        nearest = distance
      }
    }
    return threat
  }

  // Busy with a butterfly or a cottage trip, and not to be recruited elsewhere.
  private isOccupied(cat: Cat) {
    return cat.objective?.kind === 'chase' || cat.cottage !== null
  }

  // Out exploring, or at loose ends; a cat settled at a favorite spot stays.
  private isAtLooseEnds(cat: Cat) {
    return (
      cat.cafeWorker === null &&
      cat.cafeCustomer === null &&
      cat.conversationId === null &&
      cat.cottage === null &&
      cat.butterflyId === null &&
      (cat.activity === 'wandering' || cat.activity === 'sitting') &&
      (!cat.objective ||
        (cat.objective.kind === 'explore' &&
          cat.objective.phase === 'traveling'))
    )
  }

  private canChaseLaser(cat: Cat): boolean {
    return (
      cat.activity !== 'vomiting' &&
      cat.activity !== 'snacking' &&
      cat.activity !== 'resting' &&
      cat.activity !== 'lying' &&
      cat.cafeWorker === null &&
      cat.cafeCustomer === null &&
      cat.conversationId === null &&
      cat.cottage === null &&
      cat.butterflyId === null &&
      cat.objective?.kind !== 'privacy' &&
      cat.objective?.kind !== 'chase'
    )
  }

  setLaserTarget(point: Point | null): void {
    this.laserTarget = point ? { ...point } : null
  }

  private updateLaser(): void {
    if (this.laserTarget) {
      this.attractCatsToLaser(this.laserTarget)
    } else {
      this.clearLaserChase()
    }
  }

  private attractCatsToLaser(target: Point): void {
    const chasers = this.updateExistingLaserChasers(target)
    if (chasers.length < MAX_LASER_CHASERS) {
      this.recruitNewLaserChasers(target, MAX_LASER_CHASERS - chasers.length)
    }
  }

  private updateExistingLaserChasers(target: Point): Cat[] {
    const active: Cat[] = []
    for (const cat of this.cats) {
      if (cat.objective?.kind !== 'laser') continue
      const dist = Math.hypot(cat.x - target.x, cat.z - target.z)
      if (dist > LASER_LOSE_INTEREST_RADIUS) {
        cat.objective = null
        cat.timer = 1 + this.reactionRandom() * 2
        this.startActivity(cat, 'sitting', 2 + this.reactionRandom() * 3)
      } else {
        active.push(cat)
        this.stepLaserChase(cat, target, dist)
      }
    }
    return active
  }

  private recruitNewLaserChasers(target: Point, needed: number): void {
    const candidates: { cat: Cat; dist: number }[] = []
    for (const cat of this.cats) {
      if (cat.objective?.kind === 'laser' || !this.canChaseLaser(cat)) continue
      const dist = Math.hypot(cat.x - target.x, cat.z - target.z)
      if (dist <= LASER_ATTRACT_RADIUS) candidates.push({ cat, dist })
    }
    candidates.sort((a, b) => a.dist - b.dist)
    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      this.startLaserChase(candidates[i].cat, target, candidates[i].dist)
    }
  }

  private startLaserChase(cat: Cat, target: Point, dist: number): void {
    const conv = this.conversations.find((c) => c.members.includes(cat.id))
    if (conv) this.endConversation(conv)
    cat.objective = {
      kind: 'laser',
      phase: 'traveling',
      destination: { ...target },
      hangout: null,
      friendId: null,
      duration: 60,
      startedAt: this.elapsed,
      deadline: this.elapsed + 60,
      nextRouteAt: this.elapsed + 0.15,
    }
    this.startActivity(cat, 'wandering', 60)
    this.emote(cat, 'butterfly')
    cat.travelMode = dist > 5 ? 'sprinting' : 'trotting'
  }

  private stepLaserChase(cat: Cat, target: Point, dist: number): void {
    if (!cat.objective) return
    cat.objective.destination = { ...target }
    if (dist < 1.4) {
      cat.target = { x: cat.x, z: cat.z }
      cat.travelMode = 'walking'
    } else {
      cat.travelMode = dist > 5 ? 'sprinting' : 'trotting'
      cat.target = { x: target.x, z: target.z }
      cat.route = [{ x: target.x, z: target.z }]
    }
  }

  private clearLaserChase(): void {
    for (const cat of this.cats) {
      if (cat.objective?.kind === 'laser') {
        cat.objective = null
        cat.timer = 1 + this.reactionRandom() * 2
      }
    }
  }

  private canChase(cat: Cat) {
    return (
      this.isAtLooseEnds(cat) &&
      this.elapsed >= (this.chaseReadyAt.get(cat.id) ?? 0)
    )
  }

  private beginChase(cat: Cat, butterfly: Butterfly) {
    // The errand can wait until the butterfly is gone.
    if (cat.objective)
      cat.schedule.unshift({
        ...cat.objective,
        dueAt: this.elapsed,
        resume: true,
      })
    this.beginObjective(cat, {
      kind: 'chase',
      destination: { x: butterfly.x, z: butterfly.z },
      hangout: null,
      friendId: null,
      duration: 8 + this.butterflyRandom() * 8,
    })
    // Most followers eventually break into a run; some only ever tag along.
    cat.objective!.chaseAt =
      this.butterflyRandom() < 0.15
        ? Infinity
        : this.elapsed + 1.2 + this.butterflyRandom() * 2.5
    cat.butterflyId = butterfly.id
    butterfly.chaserId = cat.id
    this.emote(cat, 'butterfly')
  }

  private updateChase(cat: Cat, objective: Objective) {
    const butterfly =
      cat.butterflyId === null ? undefined : this.butterflies[cat.butterflyId]
    if (!butterfly || this.elapsed >= objective.deadline) {
      this.endChase(cat, butterfly)
      return
    }
    const chasing = this.elapsed >= (objective.chaseAt ?? Infinity)
    const dx = butterfly.x - cat.x
    const dz = butterfly.z - cat.z
    const distance = Math.hypot(dx, dz)
    cat.travelMode = !chasing
      ? 'walking'
      : distance < 4
        ? 'sprinting'
        : 'trotting'
    // A follower keeps a polite distance; a chaser runs right underneath.
    const standoff = chasing ? 0 : 2.2
    const destination =
      distance > standoff + 0.2
        ? {
            x: butterfly.x - (dx / distance) * standoff,
            z: butterfly.z - (dz / distance) * standoff,
          }
        : { x: cat.x, z: cat.z }
    const radius = CAT_RADIUS * cat.scale
    // Over the creek or bridge, a cottage, or the cafe patio, it has gotten away.
    if (
      cat.blockedTime > 2 ||
      !isWalkable(destination.x, destination.z, radius) ||
      isOnBridgeOrApproach(destination.x, destination.z, radius) ||
      isOnCafeTerrace(destination.x, destination.z, radius) ||
      isInCafeQueueLane(destination.x, destination.z, radius)
    ) {
      this.endChase(cat, butterfly)
      return
    }
    objective.destination = destination
    if (clearSegment(cat, destination, radius, this.staffOnly(cat))) {
      cat.route = [destination]
      cat.target = destination
    } else if (this.elapsed >= objective.nextRouteAt) {
      this.routeObjective(cat)
      objective.nextRouteAt = this.elapsed + 1
      if (!cat.route.length) this.endChase(cat, butterfly)
    } else if (
      cat.route.length > 1 &&
      Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z) < 0.8
    ) {
      cat.route.shift()
      cat.target = cat.route[0]
    }
  }

  private endChase(cat: Cat, butterfly?: Butterfly) {
    cat.objective = null
    this.chaseReadyAt.set(
      cat.id,
      this.elapsed + 60 + this.butterflyRandom() * 90,
    )
    // Sit and watch it flutter off before getting back to the day.
    this.startActivity(cat, 'sitting', 2.5 + this.butterflyRandom() * 3)
    cat.butterflyId = butterfly?.id ?? null
  }

  private updateCottages() {
    for (const cottage of this.cottages) {
      // A door that stays jammed for too long sends the line off elsewhere.
      for (const id of [...cottage.line]) {
        const cat = this.catById(id)
        if (cat?.cottage?.stage !== 'waiting')
          cottage.line.splice(cottage.line.indexOf(id), 1)
        else if (this.elapsed - cat.cottage.since > 45) this.leaveLine(cat)
      }
      if (cottage.occupants.length && this.elapsed >= cottage.nextExitAt)
        this.planExits(cottage)
      if (cottage.doorwayId === null) this.openDoor(cottage)
    }
    if (this.elapsed >= this.nextCottageTripAt) {
      this.nextCottageTripAt = this.elapsed + 15 + this.cottageRandom() * 20
      if (!this.treat) this.planCottageTrip()
    }
  }

  private updatePicnicTrips() {
    if (this.elapsed < this.nextPicnicTripAt) return
    this.nextPicnicTripAt = this.elapsed + 7 + this.picnicRandom() * 9
    if (this.treat) return
    this.planPicnicTrip()
  }

  private planPicnicTrip() {
    const westVisitors = this.cats.filter(
      (cat) => cat.id < 85 && (cat.objective?.kind === 'picnic' || cat.x > 24),
    )
    if (westVisitors.length >= 5) return
    const candidates = this.cats.filter(
      (cat) =>
        cat.id < 85 &&
        cat.x < 15 &&
        cat.cafeWorker === null &&
        cat.cafeCustomer === null &&
        cat.cottage === null &&
        cat.conversationId === null &&
        cat.snack === null &&
        (cat.activity === 'wandering' || cat.activity === 'sitting') &&
        cat.objective?.kind !== 'privacy' &&
        cat.objective?.kind !== 'visit' &&
        cat.objective?.kind !== 'chase' &&
        this.elapsed >= (this.picnicReturnAt.get(cat.id) ?? 0),
    )
    if (!candidates.length) return
    const pick = candidates[Math.floor(this.picnicRandom() * candidates.length)]
    // A free spot on one of the blankets across the creek.
    const blanket =
      picnicBlankets[Math.floor(this.picnicRandom() * picnicBlankets.length)]
    let target = { x: blanket.x, z: blanket.z }
    for (let attempt = 0; attempt < 8; attempt++) {
      const spot = blanketSpot(blanket, this.picnicRandom, 0.6)
      if (this.canOccupy(spot.x, spot.z, catRadius(pick) + 0.15, pick.id)) {
        target = spot
        break
      }
    }
    this.beginObjective(pick, {
      kind: 'picnic',
      destination: target,
      hangout: 'picnic',
      friendId: null,
      duration: 18 + this.picnicRandom() * 10,
    })
    pick.travelMode = this.picnicRandom() < 0.6 ? 'trotting' : 'walking'
  }

  private planCottageTrip() {
    const cottage =
      this.cottages[Math.floor(this.cottageRandom() * this.cottages.length)]
    const visitors = this.cats.filter(
      (cat) =>
        cat.cottage?.cottageId === cottage.id &&
        cat.cottage.stage !== 'leaving',
    )
    const incoming = visitors.filter(
      (cat) =>
        cat.cottage!.stage === 'arriving' || cat.cottage!.stage === 'waiting',
    )
    const room = Math.min(
      COTTAGE_CAPACITY - visitors.length,
      COTTAGE_LINE_LENGTH - incoming.length,
    )
    if (room <= 0) return
    const distance = (cat: Cat, point: Point = cottage) =>
      Math.hypot(cat.x - point.x, cat.z - point.z)
    const candidates = this.cats
      .filter(
        (cat) =>
          this.isAtLooseEnds(cat) &&
          this.elapsed >= (this.cottageReadyAt.get(cat.id) ?? 0) &&
          distance(cat) < 30,
      )
      .sort((a, b) => distance(a) - distance(b))
    if (!candidates.length) return
    const leader =
      candidates[
        Math.floor(this.cottageRandom() ** 2 * Math.min(candidates.length, 12))
      ]
    // Often a friend or two nearby comes along.
    const roll = this.cottageRandom()
    const size = Math.min(room, roll < 0.4 ? 1 : roll < 0.8 ? 2 : 3)
    const group = [
      leader,
      ...candidates
        .filter((cat) => cat !== leader && distance(cat, leader) < 8)
        .sort((a, b) => distance(a, leader) - distance(b, leader))
        .slice(0, size - 1),
    ]
    const taken = incoming.map((cat) => cat.cottage!.place)
    for (const cat of group) {
      const place = [...Array(COTTAGE_LINE_LENGTH).keys()].find(
        (index) => !taken.includes(index),
      )!
      taken.push(place)
      // Whatever they were up to can wait until they come back out.
      if (cat.objective)
        cat.schedule.unshift({
          ...cat.objective,
          dueAt: this.elapsed,
          resume: true,
        })
      this.beginObjective(cat, {
        kind: 'cottage',
        destination: cottageLineSpot(cottage, place),
        hangout: null,
        friendId: null,
        duration: 0,
      })
      cat.cottage = {
        cottageId: cottage.id,
        stage: 'arriving',
        place,
        path: [],
        since: this.elapsed,
      }
    }
  }

  private leaveLine(cat: Cat) {
    const cottage = this.cottages[cat.cottage!.cottageId]
    cottage.line.splice(cottage.line.indexOf(cat.id), 1)
    cat.cottage = null
    cat.objective = null
    this.startActivity(cat, 'sitting', 3 + this.cottageRandom() * 3)
  }

  // Small groups head back out, longest visitors first.
  private planExits(cottage: Cottage) {
    const ready = cottage.occupants.filter(
      (id) =>
        !cottage.exitQueue.includes(id) &&
        this.elapsed - this.catById(id)!.cottage!.since >= 30,
    )
    if (!ready.length) {
      cottage.nextExitAt = this.elapsed + 5
      return
    }
    const roll = this.cottageRandom()
    cottage.exitQueue.push(
      ...ready.slice(0, roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3),
    )
    cottage.nextExitAt = this.elapsed + 25 + this.cottageRandom() * 45
  }

  // One resident through the door at a time, taking turns coming and going.
  private openDoor(cottage: Cottage) {
    const leaving = this.catById(cottage.exitQueue[0])
    const entering = cottage.line
      .map((id) => this.catById(id)!)
      .sort((a, b) => a.cottage!.place - b.cottage!.place)[0]
    if (leaving && (cottage.lastThrough === 'in' || !entering)) {
      if (this.beginLeaving(cottage, leaving) || !entering) return
    }
    if (entering) this.beginEntering(cottage, entering)
  }

  private beginEntering(cottage: Cottage, cat: Cat) {
    const doorway = cottageDoorway(cottage)
    cottage.line.splice(cottage.line.indexOf(cat.id), 1)
    cottage.doorwayId = cat.id
    cottage.lastThrough = 'in'
    cat.objective = null
    this.startActivity(cat, 'indoors', 0)
    cat.discussion = 0
    cat.speaking = 0
    cat.cottage = {
      ...cat.cottage!,
      stage: 'entering',
      path: [doorway.threshold, doorway.door, doorway.inside],
      since: this.elapsed,
    }
  }

  private beginLeaving(cottage: Cottage, cat: Cat) {
    const exit = cottageExitSpots(cottage).find((spot) =>
      this.canOccupy(spot.x, spot.z, CAT_RADIUS * cat.scale + 0.15, cat.id),
    )
    if (!exit) return false
    const doorway = cottageDoorway(cottage)
    cottage.exitQueue.shift()
    cottage.occupants.splice(cottage.occupants.indexOf(cat.id), 1)
    cottage.doorwayId = cat.id
    cottage.lastThrough = 'out'
    cat.x = doorway.inside.x
    cat.z = doorway.inside.z
    cat.heading = 0
    cat.angularVelocity = 0
    cat.cottage = {
      ...cat.cottage!,
      stage: 'leaving',
      path: [doorway.door, doorway.threshold, exit],
      since: this.elapsed,
    }
    return true
  }

  // Through the doorway on a set path: the walls are no obstacle here.
  private walkDoorway(cat: Cat, dt: number) {
    const visit = cat.cottage!
    const cottage = this.cottages[visit.cottageId]
    let traveled = 0
    const speed = TRAVEL_SPEEDS.walking * cat.pace
    const next = visit.path[0]
    if (next) {
      const dx = next.x - cat.x
      const dz = next.z - cat.z
      const distance = Math.hypot(dx, dz)
      traveled = Math.min(distance, speed * dt)
      if (distance > 1e-6) {
        cat.x += (dx / distance) * traveled
        cat.z += (dz / distance) * traveled
        cat.velocity.x = (dx / distance) * speed
        cat.velocity.z = (dz / distance) * speed
        this.turnToward(cat, Math.atan2(dx, dz), dt)
      }
      if (distance <= speed * dt) visit.path.shift()
    } else if (visit.stage === 'entering') {
      cottage.doorwayId = null
      cottage.occupants.push(cat.id)
      cat.cottage = { ...visit, stage: 'inside', path: [], since: this.elapsed }
      cat.x = cottage.x
      cat.z = cottage.z
    } else if (visit.stage === 'leaving') {
      if (this.canOccupy(cat.x, cat.z, catRadius(cat), cat.id)) {
        cottage.doorwayId = null
        cat.cottage = null
        this.cottageReadyAt.set(
          cat.id,
          this.elapsed + 90 + this.cottageRandom() * 120,
        )
        this.startActivity(cat, 'wandering', 0.5 + this.cottageRandom())
      } else {
        // Someone wandered into the way: step over to the nearest open spot.
        visit.path.push(
          this.point(
            cat.x - 4,
            cat.x + 4,
            cat.z,
            cat.z + 5,
            catRadius(cat) + 0.15,
            cat.id,
          ),
        )
      }
    }
    if (!next) {
      cat.velocity.x = 0
      cat.velocity.z = 0
    }
    const walking = Math.min(1, traveled / (dt * speed))
    cat.walking += (walking - cat.walking) * (1 - Math.exp(-dt * 8))
    cat.travelSpeed +=
      (traveled / dt - cat.travelSpeed) * (1 - Math.exp(-dt * 7))
    cat.gait += traveled * (5 - Math.min(1.4, cat.travelSpeed * 0.32))
  }

  private catById(id: number | null | undefined) {
    if (id === null || id === undefined) return undefined
    const cat = this.cats[id]
    return cat?.id === id ? cat : this.cats.find((other) => other.id === id)
  }

  private cafeStaff() {
    return this.cats.filter((cat) => cat.cafeWorker !== null)
  }

  private initCafeWorkers() {
    // Open for business: everyone else spawned clear of the kiosk.
    for (const [station, id] of CAFE_WORKER_IDS.entries()) {
      const cat = this.catById(id)
      if (!cat) continue
      cat.activity = 'working'
      cat.nextVomitAt = Infinity
      cat.pose = { sitting: 0, lying: 0, vomiting: 0 }
      cat.cafeWorker = { ...this.newShift(station, null), state: 'idle' }
      const spot = this.stationSpot(station)
      cat.x = spot.x
      cat.z = spot.z
      cat.heading = spot.heading
      cat.target = { x: spot.x, z: spot.z }
      cat.route = []
    }
  }

  private newShift(station: number, relievingId: number | null) {
    const shift: CafeWorkerState = {
      station,
      role: station === 0 && relievingId === null ? 'barista' : 'server',
      state: 'reporting',
      relievingId,
      shiftStartedAt: this.elapsed,
      customerId: null,
      order: null,
      orderSpeakers: [],
      targetTableId: null,
      carriedItem: null,
      facing: null,
      timer: 0,
      idleTimer: 0,
    }
    return shift
  }

  private stationSpot(station: number) {
    return station === 0
      ? CAFE_BARISTA_STATION
      : (CAFE_SERVER_STATIONS[station - 1] ?? CAFE_SERVER_STATIONS[0])
  }

  private cafeWaitingCount() {
    return this.cafeQueue.filter(
      (id) => this.catById(id)?.cafeCustomer?.stage !== 'joining',
    ).length
  }

  private queueSpot(place: number) {
    return place === 0
      ? CAFE_ORDER_SPOT
      : CAFE_QUEUE_SLOTS[Math.min(place, CAFE_QUEUE_SLOTS.length) - 1]
  }

  private isOrderChat(cat: Cat) {
    if (!cat.dialogue) return false
    const customer = cat.cafeCustomer
    const worker = cat.cafeWorker
    return (
      (customer !== null &&
        (customer.stage === 'ordering' || customer.stage === 'waiting')) ||
      (worker !== null &&
        (worker.state === 'taking_order' ||
          worker.state === 'prepping' ||
          worker.state === 'serving'))
    )
  }

  private updateCafe(dt: number) {
    const barista = this.cats.some(
      (cat) => cat.cafeWorker?.role === 'barista' && isOnShift(cat),
    )
    if (!barista) return
    this.updateCafeWorkers(dt)
    if (this.elapsed >= this.nextCafeCustomerAt) {
      this.nextCafeCustomerAt = this.elapsed + 11 + this.cafeRandom() * 10
      if (!this.treat) this.inviteCafeCustomers()
    }
    this.tidyCafeLine()
    for (const cat of this.cats)
      if (cat.cafeCustomer) this.updateCafeCustomer(cat, dt)
  }

  // If a cat has clearly ended up ahead of someone in line, they swap places,
  // so nobody has to squeeze past.
  private tidyCafeLine() {
    const start = this.cafeQueue.findIndex(
      (id) => this.catById(id)?.cafeCustomer?.stage === 'queuing',
    )
    if (start < 0) return
    let end = start
    while (
      end < this.cafeQueue.length &&
      this.catById(this.cafeQueue[end])?.cafeCustomer?.stage === 'queuing'
    )
      end++
    const progress = (id: number) => {
      const cat = this.catById(id)!
      return cafeLanePosition(cat.x, cat.z).progress
    }
    for (let i = start + 1; i < end; i++) {
      const behind = this.cafeQueue[i],
        ahead = this.cafeQueue[i - 1]
      if (progress(behind) < progress(ahead) - 0.8) {
        this.cafeQueue[i] = ahead
        this.cafeQueue[i - 1] = behind
      }
    }
  }

  private inviteCafeCustomers() {
    const room = CAFE_QUEUE_CAPACITY - this.cafeQueue.length
    if (room <= 0) return
    const distance = (cat: Cat) =>
      Math.hypot(cat.x - CAFE_ORDER_SPOT.x, cat.z - CAFE_ORDER_SPOT.z)
    const candidates = this.cats
      .filter(
        (cat) =>
          cat.cafeWorker === null &&
          cat.cafeCustomer === null &&
          cat.conversationId === null &&
          (cat.activity === 'wandering' || cat.activity === 'sitting') &&
          cat.objective?.kind !== 'privacy' &&
          cat.objective?.kind !== 'visit' &&
          !this.isOccupied(cat) &&
          this.elapsed >= (this.cafeReturnAt.get(cat.id) ?? 0) &&
          distance(cat) < 32,
      )
      .sort((a, b) => distance(a) - distance(b))
    // Friends sometimes wander over together, and nearby cats are likelier to notice.
    const party = Math.min(room, this.cafeRandom() < 0.3 ? 2 : 1)
    for (let i = 0; i < party && candidates.length; i++) {
      const pick = Math.floor(
        this.cafeRandom() ** 2 * Math.min(candidates.length, 14),
      )
      this.joinCafeQueue(candidates.splice(pick, 1)[0])
    }
  }

  private joinCafeQueue(cat: Cat) {
    if (cat.objective?.phase === 'traveling')
      cat.schedule.unshift({
        ...cat.objective,
        dueAt: this.elapsed,
        resume: true,
      })
    cat.objective = null
    this.startActivity(cat, 'wandering', 0)
    const place = this.cafeWaitingCount()
    this.cafeQueue.push(cat.id)
    cat.cafeCustomer = {
      stage: 'joining',
      place,
      foodItem: null,
      seatIndex: null,
      spot: null,
      facing: null,
      elevation: 0,
      hop: null,
      hopFrom: null,
      joinedAt: this.elapsed,
      timer: 0,
      duration: 0,
    }
    this.walkCafeCustomer(cat, this.queueSpot(place), 'trotting')
  }

  private walkCafeCustomer(
    cat: Cat,
    spot: Point,
    travelMode: TravelMode,
    avoidResidents = false,
    via?: Point,
  ) {
    cat.travelMode = travelMode
    const radius = CAT_RADIUS * cat.scale
    const entrance = this.staffOnly(cat)
    // Newcomers walk around the line and the counter to reach the back.
    const joining = cat.cafeCustomer?.stage === 'joining'
    const line = joining ? this.lineBlockers(cat) : []
    if (joining && this.cafeWaitingCount() > 0)
      line.push({ x: CAFE_ORDER_SPOT.x, z: CAFE_ORDER_SPOT.z, radius: 2.4 })
    // Cats already in line wait for their neighbors instead of detouring.
    const inLine = cat.cafeCustomer?.stage === 'queuing'
    const blockers = [
      ...entrance,
      ...line,
      ...(avoidResidents
        ? this.nearbyBlockers(
            cat,
            (other) => inLine && this.cafeQueue.includes(other.id),
          )
        : []),
    ]
    const from = via ?? cat
    let route = findRoute(from, spot, radius + 0.08, blockers)
    if (!route.length) route = findRoute(from, spot, radius, entrance)
    if (!route.length) route = [{ x: spot.x, z: spot.z }]
    cat.route = via ? [{ x: via.x, z: via.z }, ...route] : route
    cat.target = cat.route[0]
  }

  private lineBlockers(cat: Cat) {
    return this.cafeQueue
      .map((id) => this.catById(id))
      .filter(
        (other): other is Cat =>
          other !== undefined &&
          other.id !== cat.id &&
          other.cafeCustomer?.stage !== 'joining',
      )
      .map((other) => ({
        x: other.x,
        z: other.z,
        radius: catRadius(other) + 0.08,
      }))
  }

  private nearbyBlockers(cat: Cat, ignore?: (other: Cat) => boolean) {
    return this.cats
      .filter(
        (other) =>
          other.id !== cat.id &&
          !sharesSpace(cat, other) &&
          !ignore?.(other) &&
          Math.hypot(other.x - cat.x, other.z - cat.z) < 7,
      )
      .map((other) => ({
        x: other.x,
        z: other.z,
        radius: catRadius(other) + 0.08,
      }))
  }

  // Without progress for a few seconds, reroute around neighbors; if that
  // doesn't help either, step aside toward open space and try again.
  private unstick(cat: Cat, destination: Point, reroute: () => void) {
    const distance = Math.hypot(cat.x - destination.x, cat.z - destination.z)
    const progress = this.cafeProgress.get(cat.id)
    if (
      !progress ||
      progress.destination.x !== destination.x ||
      progress.destination.z !== destination.z ||
      distance < progress.best - 0.4
    ) {
      this.cafeProgress.set(cat.id, {
        destination: { x: destination.x, z: destination.z },
        best: distance,
        since: this.elapsed,
        attempts: progress?.attempts ?? 0,
      })
      return
    }
    // Stalled at a waypoint whose next leg is blocked: plan again right away.
    const atWaypoint =
      Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z) < 0.5
    if (!atWaypoint && this.elapsed - progress.since < 3) return
    progress.since = this.elapsed
    progress.best = distance
    if (atWaypoint || ++progress.attempts % 2) {
      reroute()
      return
    }
    let best: Point | null = null
    let bestScore = -Infinity
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const step = {
        x: cat.x + Math.sin(angle) * 1.4,
        z: cat.z + Math.cos(angle) * 1.4,
      }
      if (!this.canMove(cat, step.x, step.z)) continue
      const score =
        this.cafeRandom() -
        Math.hypot(step.x - destination.x, step.z - destination.z) * 0.3
      if (score > bestScore) {
        best = step
        bestScore = score
      }
    }
    if (!best) return
    cat.route = [best]
    cat.target = best
  }

  private followCafeRoute(cat: Cat) {
    const next = cat.route[1]
    if (
      next &&
      Math.hypot(cat.x - cat.target.x, cat.z - cat.target.z) < 0.9 &&
      clearSegment(
        cat,
        next,
        isBehindCounter(next) ? bodyRadius(cat) : catRadius(cat),
        this.staffOnly(cat),
      )
    ) {
      cat.route.shift()
      cat.target = cat.route[0]
    }
  }

  private arrived(cat: Cat, spot: Point, patience: number, timer: number) {
    const distance = Math.hypot(cat.x - spot.x, cat.z - spot.z)
    const still = Math.hypot(cat.velocity.x, cat.velocity.z) < 0.3
    // A neighbor planted nearby shouldn't hold up the whole line forever.
    return (
      still &&
      cat.route.length <= 1 &&
      (distance < 0.6 || (timer > patience && distance < 1.3))
    )
  }

  private updateCafeCustomer(cat: Cat, dt: number) {
    const customer = cat.cafeCustomer!
    customer.timer += dt
    this.followCafeRoute(cat)
    if (this.cafeQueue.includes(cat.id)) {
      // A last resort; the line normally keeps moving.
      if (
        customer.stage !== 'waiting' &&
        this.elapsed - customer.joinedAt > 300
      ) {
        this.leaveCafe(cat)
        return
      }
      // Cats in line keep their place; newcomers always head for the back.
      const place =
        customer.stage === 'joining'
          ? this.cafeWaitingCount()
          : this.cafeQueue.indexOf(cat.id)
      const spot = this.queueSpot(place)
      if (place !== customer.place) {
        // The line moved up: stand, then shuffle forward.
        customer.place = place
        customer.timer = 0
        if (cat.activity !== 'wandering')
          this.startActivity(cat, 'wandering', 0)
        this.walkCafeCustomer(
          cat,
          spot,
          customer.stage === 'joining' ? cat.travelMode : 'walking',
        )
      }
      const ahead = place === 0 ? null : this.queueSpot(place - 1)
      customer.facing = ahead
        ? Math.atan2(ahead.x - cat.x, ahead.z - cat.z)
        : CAFE_ORDER_SPOT.heading
      if (customer.stage === 'joining') {
        // Reaching the line itself is joining it, in the order cats stand.
        const lane = cafeLanePosition(cat.x, cat.z)
        if (lane.offset < 1.2) {
          const ahead = this.cafeQueue.filter((id) => {
            const other = this.catById(id)
            if (!other?.cafeCustomer || other.cafeCustomer.stage === 'joining')
              return false
            return cafeLanePosition(other.x, other.z).progress < lane.progress
          }).length
          this.cafeQueue.splice(this.cafeQueue.indexOf(cat.id), 1)
          this.cafeQueue.splice(ahead, 0, cat.id)
          customer.stage = 'queuing'
          customer.place = -1
          customer.timer = 0
          return
        }
      }
      if (customer.stage === 'joining' || customer.stage === 'queuing') {
        if (!this.arrived(cat, spot, 8, customer.timer)) {
          // Step around whoever is in the way, including a cat who got ahead.
          this.unstick(cat, spot, () =>
            this.walkCafeCustomer(cat, spot, cat.travelMode, true),
          )
          return
        }
        if (customer.stage === 'joining') return
        if (place === 0) {
          customer.stage = 'ordering'
          customer.timer = 0
        } else if (customer.timer > 4 && cat.activity === 'wandering')
          this.startActivity(cat, 'sitting', 0)
      }
      return
    }
    const seat =
      customer.seatIndex === null ? null : this.cafeSeats[customer.seatIndex]
    if (customer.stage === 'carrying') {
      if (!customer.spot) {
        this.leaveCafe(cat)
        return
      }
      const goal = seat?.approach ?? customer.spot
      if (customer.timer > 45 && seat) {
        // Never made it through the crowd: a picnic on the lawn instead.
        this.releaseSeat(cat)
        this.choosePicnicSpot(cat)
        customer.timer = 0
        this.walkCafeCustomer(cat, customer.spot, 'walking', true)
      } else if (this.arrived(cat, goal, 20, customer.timer)) {
        if (seat) {
          customer.stage = 'hopping_on'
          customer.timer = 0
          cat.route = []
        } else this.startEating(cat)
      } else
        this.unstick(cat, goal, () =>
          this.walkCafeCustomer(cat, goal, 'walking', true),
        )
      return
    }
    if (customer.stage === 'hopping_on' && seat) {
      this.hop(cat, seat, true, dt)
      return
    }
    if (customer.stage === 'hopping_off' && seat) {
      this.hop(cat, seat, false, dt)
      return
    }
    if (customer.stage === 'eating') {
      customer.facing = customer.spot?.heading ?? null
      if (customer.timer >= customer.duration) this.finishEating(cat)
      return
    }
    if (customer.stage === 'leaving' && cat.pose.sitting < 0.01) {
      cat.cafeCustomer = null
      this.cafeReturnAt.set(
        cat.id,
        this.elapsed + 150 + this.cafeRandom() * 150,
      )
      this.startActivity(cat, 'wandering', 1 + this.cafeRandom() * 2)
    }
  }

  // After the handoff, find a free stool, or a sunny patch of grass nearby.
  private chooseDiningSpot(cat: Cat) {
    const seat = this.cafeSeats
      .filter((candidate) => candidate.stage === 'free')
      .sort(
        (a, b) =>
          Math.hypot(a.x - cat.x, a.z - cat.z) -
          Math.hypot(b.x - cat.x, b.z - cat.z),
      )[0]
    const customer = cat.cafeCustomer!
    if (seat) {
      seat.stage = 'reserved'
      seat.occupantId = cat.id
      customer.seatIndex = seat.index
      customer.spot = { x: seat.x, z: seat.z, heading: seat.heading }
      return
    }
    this.choosePicnicSpot(cat)
  }

  // A picnic on the lawn just past the patio, facing the cafe.
  private choosePicnicSpot(cat: Cat) {
    const customer = cat.cafeCustomer!
    const radius = catRadius(cat)
    for (let attempt = 0; attempt < 60; attempt++) {
      const angle = this.cafeRandom() * Math.PI * 2
      const distance = CAFE_TERRACE_RADIUS + 2.2 + this.cafeRandom() * 3
      const point = {
        x: CAFE_TERRACE_CENTER.x + Math.sin(angle) * distance * 1.05,
        z: CAFE_TERRACE_CENTER.z + Math.cos(angle) * distance * 1.06,
      }
      if (
        !this.canOccupy(point.x, point.z, radius + 0.4, cat.id) ||
        isOnCafeTerrace(point.x, point.z, radius) ||
        isInCafeQueueLane(point.x, point.z, radius + 1) ||
        Math.abs(point.x - meadowPathX(point.z)) < 3
      )
        continue
      customer.spot = {
        ...point,
        heading: Math.atan2(
          CAFE_TERRACE_CENTER.x - point.x,
          CAFE_TERRACE_CENTER.z - point.z,
        ),
      }
      return
    }
    customer.spot = { x: cat.x, z: cat.z + 3, heading: 0 }
  }

  private startEating(cat: Cat) {
    const customer = cat.cafeCustomer!
    const seat =
      customer.seatIndex === null ? null : this.cafeSeats[customer.seatIndex]
    if (customer.seatIndex === null)
      customer.spot = { x: cat.x, z: cat.z, heading: cat.heading }
    customer.stage = 'eating'
    customer.timer = 0
    customer.duration = 16 + this.cafeRandom() * 8
    this.startActivity(cat, 'sitting', 0)
    const spot = customer.spot!
    const foodType = customer.foodItem ?? 'cat_can'
    if (seat && customer.seatIndex !== null) {
      seat.stage = 'eating'
      const table = CAFE_TABLES[seat.tableId]
      const toward = Math.atan2(seat.x - table.x, seat.z - table.z)
      this.deliveredFoods.push({
        id: this.nextDeliveredFoodId++,
        catId: cat.id,
        seatIndex: seat.index,
        foodType,
        x: table.x + Math.sin(toward) * 0.75,
        y: TABLE_SURFACE_HEIGHT,
        z: table.z + Math.cos(toward) * 0.75,
        heading: seat.heading,
      })
    } else {
      this.deliveredFoods.push({
        id: this.nextDeliveredFoodId++,
        catId: cat.id,
        seatIndex: null,
        foodType,
        x: cat.x + Math.sin(spot.heading) * 0.95 * cat.scale,
        y: 0,
        z: cat.z + Math.cos(spot.heading) * 0.95 * cat.scale,
        heading: spot.heading,
      })
    }
  }

  private finishEating(cat: Cat) {
    const customer = cat.cafeCustomer!
    const seat =
      customer.seatIndex === null ? null : this.cafeSeats[customer.seatIndex]
    // Stand up first; stool diners then turn around and hop down.
    customer.stage = seat ? 'hopping_off' : 'leaving'
    customer.timer = 0
    customer.facing = null
    if (!seat) this.removeFood((food) => food.catId === cat.id)
    this.startActivity(cat, 'wandering', 0)
    cat.target = { x: cat.x, z: cat.z }
  }

  private releaseSeat(cat: Cat) {
    const customer = cat.cafeCustomer!
    const seat =
      customer.seatIndex === null ? null : this.cafeSeats[customer.seatIndex]
    if (seat?.occupantId === cat.id) {
      seat.stage = 'free'
      seat.occupantId = null
    }
    customer.seatIndex = null
  }

  // Face the stool (or away from it), then a small arcing hop on or off.
  private hop(cat: Cat, seat: CafeSeatState, up: boolean, dt: number) {
    const customer = cat.cafeCustomer!
    const [from, to] = up
      ? [customer.hopFrom ?? cat, seat]
      : [customer.hopFrom ?? cat, seat.approach]
    cat.route = []
    cat.target = { x: cat.x, z: cat.z }
    if (customer.hop === null) {
      customer.facing = Math.atan2(to.x - cat.x, to.z - cat.z)
      const ready =
        cat.pose.sitting < 0.01 &&
        Math.cos(cat.heading - customer.facing) > 0.97 &&
        this.clearOfCats(cat, to.x, to.z, catRadius(cat))
      if (!ready) return
      customer.hop = 0
      customer.hopFrom = { x: cat.x, z: cat.z }
      return
    }
    const next = Math.min(1, customer.hop + dt / HOP_SECONDS)
    const ease = next * next * (3 - 2 * next)
    const x = from.x + (to.x - from.x) * ease
    const z = from.z + (to.z - from.z) * ease
    // Pause mid-air rather than land on a neighbor who wandered close.
    if (!this.clearOfCats(cat, x, z, catRadius(cat))) return
    customer.hop = next
    cat.x = x
    cat.z = z
    const stool = up ? ease : 1 - ease
    customer.elevation =
      STOOL_CUSHION_HEIGHT * stool + Math.sin(Math.PI * next) * HOP_HEIGHT
    if (next < 1) return
    customer.hop = null
    customer.hopFrom = null
    cat.target = { x: cat.x, z: cat.z }
    if (up) {
      customer.elevation = STOOL_CUSHION_HEIGHT
      this.startEating(cat)
      return
    }
    // The empty dish waits on the table for a server.
    customer.elevation = 0
    seat.stage = 'clearing'
    seat.occupantId = null
    customer.stage = 'leaving'
    customer.facing = null
  }

  private removeFood(match: (food: CafeDeliveredFood) => boolean) {
    for (let index = this.deliveredFoods.length - 1; index >= 0; index--)
      if (match(this.deliveredFoods[index]))
        this.deliveredFoods.splice(index, 1)
  }

  // Giving up after a very long wait, without leaving anything reserved.
  private leaveCafe(cat: Cat) {
    const customer = cat.cafeCustomer
    if (!customer) return
    const place = this.cafeQueue.indexOf(cat.id)
    if (place >= 0) this.cafeQueue.splice(place, 1)
    const seat =
      customer.seatIndex === null ? null : this.cafeSeats[customer.seatIndex]
    if (seat?.occupantId === cat.id) {
      seat.stage = 'free'
      seat.occupantId = null
    }
    this.removeFood((food) => food.catId === cat.id && food.seatIndex === null)
    cat.cafeCustomer = null
    this.cafeReturnAt.set(cat.id, this.elapsed + 90)
    this.startActivity(cat, 'wandering', 1 + this.cafeRandom() * 2)
  }

  // Staff use the kiosk's open east end, then ordinary meadow routes.
  private routeWorker(
    cat: Cat,
    dest: Point,
    travelMode: TravelMode,
    avoidResidents = false,
  ) {
    cat.travelMode = travelMode
    const radius = CAT_RADIUS * cat.scale
    const blockers = [
      ...this.lineBlockers(cat),
      ...(avoidResidents ? this.nearbyBlockers(cat) : []),
    ]
    const outdoors = (from: Point, to: Point) => {
      let route = findRoute(from, to, radius, blockers)
      if (!route.length) route = findRoute(from, to, radius)
      return route.length ? route : [{ x: to.x, z: to.z }]
    }
    const inside = isBehindCounter(cat)
    const destInside = isBehindCounter(dest)
    const route =
      inside && destInside
        ? [{ x: dest.x, z: dest.z }]
        : inside
          ? [
              { ...CAFE_KIOSK_LANE },
              { ...CAFE_KIOSK_DOOR },
              ...outdoors(CAFE_KIOSK_DOOR, dest),
            ]
          : destInside
            ? [
                ...outdoors(cat, CAFE_KIOSK_DOOR),
                { ...CAFE_KIOSK_LANE },
                { x: dest.x, z: dest.z },
              ]
            : outdoors(cat, dest)
    cat.route = route
    cat.target = route[0]
  }

  private workerAt(
    cat: Cat,
    point: Point,
    reach = 0.6,
    travelMode: TravelMode = 'walking',
  ) {
    const destination = cat.route.at(-1)
    const there = Math.hypot(cat.x - point.x, cat.z - point.z) < reach
    if (
      !there &&
      (!destination ||
        Math.hypot(destination.x - point.x, destination.z - point.z) > 0.1)
    )
      this.routeWorker(cat, point, travelMode)
    else if (!there && !isBehindCounter(cat))
      this.unstick(cat, point, () =>
        this.routeWorker(cat, point, travelMode, true),
      )
    return there
  }

  private updateCafeWorkers(dt: number) {
    if (this.elapsed >= this.nextCafeReliefAt) {
      this.nextCafeReliefAt = this.elapsed + 100 + this.cafeRandom() * 70
      this.callForRelief()
    }
    for (const cat of this.cafeStaff()) {
      const worker = cat.cafeWorker!
      this.followCafeRoute(cat)
      cat.nextVomitAt = Infinity
      if (worker.state !== 'break') cat.activity = 'working'
      worker.facing = null
      switch (worker.state) {
        case 'reporting':
          this.updateWorkerReporting(cat, worker)
          break
        case 'idle':
          this.updateWorkerIdle(cat, worker, dt)
          break
        case 'taking_order':
        case 'prepping':
        case 'serving':
          this.updateWorkerOrder(cat, worker, dt)
          break
        case 'clearing':
          this.updateWorkerClearing(cat, worker, dt)
          break
        case 'break':
          this.updateWorkerBreak(cat, worker, dt)
          break
        case 'leaving':
          this.updateWorkerLeaving(cat)
          break
      }
    }
  }

  // A neighbor wanders over to take the longest-running shift.
  private callForRelief() {
    const staff = this.cafeStaff()
    if (staff.some((cat) => !isOnShift(cat))) return
    const tired = staff.sort(
      (a, b) => a.cafeWorker!.shiftStartedAt - b.cafeWorker!.shiftStartedAt,
    )[0]
    if (!tired) return
    const door = CAFE_KIOSK_DOOR
    const distance = (cat: Cat) => Math.hypot(cat.x - door.x, cat.z - door.z)
    const candidates = this.cats
      .filter(
        (cat) =>
          cat.cafeWorker === null &&
          cat.cafeCustomer === null &&
          cat.conversationId === null &&
          (cat.activity === 'wandering' || cat.activity === 'sitting') &&
          cat.objective?.kind !== 'privacy' &&
          cat.objective?.kind !== 'visit' &&
          !this.isOccupied(cat) &&
          this.elapsed >= (this.cafeShiftDoneAt.get(cat.id) ?? 0) &&
          distance(cat) < 40,
      )
      .sort((a, b) => distance(a) - distance(b))
    const cat =
      candidates[
        Math.floor(this.cafeRandom() * Math.min(10, candidates.length))
      ]
    if (!cat) return
    if (cat.objective?.phase === 'traveling')
      cat.schedule.unshift({
        ...cat.objective,
        dueAt: this.elapsed,
        resume: true,
      })
    cat.objective = null
    this.startActivity(cat, 'working', 0)
    cat.nextVomitAt = Infinity
    cat.cafeWorker = this.newShift(tired.cafeWorker!.station, tired.id)
    this.routeWorker(cat, this.stationSpot(cat.cafeWorker.station), 'trotting')
  }

  private updateWorkerReporting(cat: Cat, worker: CafeWorkerState) {
    const tired = this.catById(worker.relievingId)
    const station = this.stationSpot(worker.station)
    if (!this.workerAt(cat, station, 1.2, 'trotting')) return
    const outgoing = tired?.cafeWorker
    // Wait for a pause in the work before swapping aprons.
    if (outgoing && outgoing.state !== 'idle' && outgoing.state !== 'break')
      return
    worker.state = 'idle'
    worker.role = worker.station === 0 ? 'barista' : 'server'
    worker.relievingId = null
    worker.shiftStartedAt = this.elapsed
    worker.idleTimer = 0
    if (!tired || !outgoing) return
    if (tired.activity === 'sitting') this.startActivity(tired, 'working', 0)
    outgoing.state = 'leaving'
    outgoing.role = 'server'
    outgoing.customerId = null
    outgoing.targetTableId = null
    outgoing.carriedItem = null
    tired.dialogue = null
    this.cafeShiftDoneAt.set(tired.id, this.elapsed + 400)
  }

  // Out through the kiosk door, then back to ordinary meadow life.
  private updateWorkerLeaving(cat: Cat) {
    if (
      !isBehindCounter(cat) &&
      Math.hypot(cat.x - CAFE_KIOSK_DOOR.x, cat.z - CAFE_KIOSK_DOOR.z) > 1.8
    ) {
      const worker = cat.cafeWorker
      cat.cafeWorker = null
      if (this.canOccupy(cat.x, cat.z, catRadius(cat), cat.id)) {
        cat.nextVomitAt = this.elapsed + 60 + this.cafeRandom() * 120
        this.startActivity(cat, 'wandering', 1 + this.cafeRandom() * 2)
        return
      }
      cat.cafeWorker = worker
    }
    this.workerAt(cat, CAFE_STAFF_EXIT, 0.8)
  }

  private updateWorkerIdle(cat: Cat, worker: CafeWorkerState, dt: number) {
    worker.idleTimer += dt
    const station = this.stationSpot(worker.station)
    const atStation = this.workerAt(cat, station)
    if (worker.role === 'barista') {
      const customer = this.catById(this.cafeQueue[0])
      if (atStation && customer?.cafeCustomer?.stage === 'ordering') {
        const order = createCafeOrder(
          this.nextDialogueId++,
          customer.id,
          this.elapsed,
          this.dialogueRandom,
          this.dialogueMemory,
        )
        customer.dialogue = order.dialogue
        cat.dialogue = order.dialogue
        worker.order = order.treat
        worker.orderSpeakers = order.speakers
        worker.state = 'taking_order'
        worker.customerId = customer.id
        worker.timer = 0
        worker.idleTimer = 0
        return
      }
    } else {
      const seat = this.cafeSeats.find(
        (candidate) =>
          candidate.stage === 'clearing' && candidate.assignedWorkerId === null,
      )
      if (seat) {
        for (const other of this.cafeSeats)
          if (other.tableId === seat.tableId && other.stage === 'clearing')
            other.assignedWorkerId = cat.id
        worker.state = 'clearing'
        worker.targetTableId = seat.tableId
        worker.timer = 0
        worker.idleTimer = 0
        return
      }
      // One break at a time keeps at least two cats working.
      const onBreak = this.cafeStaff().some(
        (other) => other.cafeWorker!.state === 'break',
      )
      if (worker.idleTimer > 28 + worker.station * 11 && !onBreak) {
        worker.state = 'break'
        worker.timer = 14
        worker.idleTimer = 0
        return
      }
    }
    if (atStation) worker.facing = station.heading
  }

  // Take the order, turn to the shelves, then hand the treat across the counter.
  private updateWorkerOrder(cat: Cat, worker: CafeWorkerState, dt: number) {
    const customer = this.catById(worker.customerId)
    const order = customer?.cafeCustomer
    if (
      !customer ||
      !order ||
      (order.stage !== 'ordering' && order.stage !== 'waiting')
    ) {
      worker.state = 'idle'
      worker.customerId = null
      worker.carriedItem = null
      cat.dialogue = null
      return
    }
    worker.timer += dt
    const towardCustomer = Math.atan2(customer.x - cat.x, customer.z - cat.z)
    const dialogue = cat.dialogue
    if (worker.state === 'taking_order') {
      worker.facing = towardCustomer
      const speakers = worker.orderSpeakers
      const turn = Math.floor(worker.timer / ORDER_TURN_SECONDS)
      if (turn < speakers.length) {
        if (dialogue && dialogue.turn !== turn) {
          dialogue.turn = turn
          dialogue.speakerId =
            speakers[turn] === 'customer' ? customer.id : cat.id
        }
        return
      }
      // Decided at last.
      order.foodItem = worker.order ?? 'cat_can'
      order.stage = 'waiting'
      worker.state = 'prepping'
      worker.timer = 0
      if (dialogue) {
        dialogue.turn = speakers.length
        dialogue.speakerId = cat.id
      }
      return
    }
    if (worker.state === 'prepping') {
      worker.facing = Math.PI
      if (worker.timer >= 3.2) {
        worker.carriedItem = order.foodItem ?? 'cat_can'
        worker.state = 'serving'
        worker.timer = 0
        if (dialogue) {
          dialogue.turn = worker.orderSpeakers.length + 1
          dialogue.speakerId = cat.id
        }
      }
      return
    }
    worker.facing = towardCustomer
    if (worker.timer < 1.6) return
    worker.carriedItem = null
    worker.order = null
    worker.state = 'idle'
    worker.customerId = null
    worker.idleTimer = 0
    cat.dialogue = null
    this.cafeQueue.splice(this.cafeQueue.indexOf(customer.id), 1)
    order.stage = 'carrying'
    order.timer = 0
    order.facing = null
    customer.dialogue = null
    this.chooseDiningSpot(customer)
    const seat =
      order.seatIndex === null ? null : this.cafeSeats[order.seatIndex]
    this.walkCafeCustomer(
      customer,
      seat?.approach ?? order.spot!,
      'walking',
      false,
      CAFE_PICKUP_EXIT,
    )
  }

  private updateWorkerClearing(cat: Cat, worker: CafeWorkerState, dt: number) {
    const table = CAFE_TABLES[worker.targetTableId ?? -1]
    if (!table) {
      worker.state = 'idle'
      return
    }
    if (!this.workerAt(cat, table.approach, 1)) return
    worker.facing = Math.atan2(table.x - cat.x, table.z - cat.z)
    worker.timer += dt
    if (worker.timer < 1.6) return
    for (const seat of this.cafeSeats)
      if (seat.tableId === table.id && seat.assignedWorkerId === cat.id) {
        seat.stage = 'free'
        seat.assignedWorkerId = null
        this.removeFood((food) => food.seatIndex === seat.index)
      }
    worker.targetTableId = null
    worker.state = 'idle'
    worker.idleTimer = 0
  }

  private updateWorkerBreak(cat: Cat, worker: CafeWorkerState, dt: number) {
    if (cat.activity === 'sitting') {
      worker.facing = CAFE_BREAK_BENCH.heading
      worker.timer -= dt
      if (worker.timer <= 0) {
        cat.activity = 'working'
        worker.state = 'idle'
        worker.idleTimer = 0
      }
      return
    }
    if (this.workerAt(cat, CAFE_BREAK_BENCH, 0.8))
      this.startActivity(cat, 'sitting', 0)
  }

  getCarriedItems(): CafeWorkerCarriedItem[] {
    const items: CafeWorkerCarriedItem[] = []
    for (const cat of this.cats) {
      const foodType =
        cat.cafeWorker?.carriedItem ??
        (cat.cafeCustomer?.stage === 'carrying' ||
        cat.cafeCustomer?.stage === 'hopping_on'
          ? cat.cafeCustomer.foodItem
          : null)
      if (foodType)
        items.push({
          catId: cat.id,
          foodType,
          x: cat.x,
          y: cat.cafeCustomer?.elevation ?? 0,
          z: cat.z,
          heading: cat.heading,
        })
    }
    return items
  }

  snapshot(): Snapshot {
    const counts: Record<Activity, number> = {
      wandering: 0,
      resting: 0,
      sitting: 0,
      lying: 0,
      vomiting: 0,
      socializing: 0,
      conversing: 0,
      snacking: 0,
      working: 0,
      indoors: 0,
    }
    for (const cat of this.cats) counts[cat.activity]++
    return {
      cats: this.cats.map((cat) => ({
        ...cat,
        cafeWorker: cat.cafeWorker ? { ...cat.cafeWorker } : null,
        cafeCustomer: cat.cafeCustomer
          ? {
              ...cat.cafeCustomer,
              spot: cat.cafeCustomer.spot ? { ...cat.cafeCustomer.spot } : null,
              hopFrom: cat.cafeCustomer.hopFrom
                ? { ...cat.cafeCustomer.hopFrom }
                : null,
            }
          : null,
        dialogue: cat.dialogue
          ? { ...cat.dialogue, lines: [...cat.dialogue.lines] }
          : null,
        cottage: cat.cottage
          ? {
              ...cat.cottage,
              path: cat.cottage.path.map((point) => ({ ...point })),
            }
          : null,
        pose: { ...cat.pose },
        snack: cat.snack ? { ...cat.snack, spot: { ...cat.snack.spot } } : null,
        target: { ...cat.target },
        objective: cat.objective
          ? { ...cat.objective, destination: { ...cat.objective.destination } }
          : null,
        schedule: cat.schedule.map((entry) => ({
          ...entry,
          destination: { ...entry.destination },
        })),
        favorites: cat.favorites.map((spot) => ({
          ...spot,
          point: { ...spot.point },
        })),
        friends: [...cat.friends],
        route: cat.route.map((point) => ({ ...point })),
        velocity: { ...cat.velocity },
      })),
      counts,
      elapsed: this.elapsed,
      treat: this.treat,
      cafeQueue: [...this.cafeQueue],
      cafeSeats: this.cafeSeats.map((seat) => ({
        ...seat,
        approach: { ...seat.approach },
      })),
      deliveredFoods: this.deliveredFoods.map((f) => ({ ...f })),
      carriedItems: this.getCarriedItems(),
    }
  }
}
