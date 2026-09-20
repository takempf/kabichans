// A couplet is a call and its answer; the pair is always spoken together, in order.
type Line = string | readonly [string, string]

export const DIALOGUE_TOPICS: readonly {
  id: 'mommy' | 'food' | 'vomiting' | 'lounging' | 'churu' | 'meadow' | 'cafe'
  name: string
  lines: readonly Line[]
}[] = [
  {
    id: 'mommy',
    name: "mommy's love",
    lines: [
      'Mommy loves my little face.',
      'She said I am her baby.',
      'I saved her a warm spot.',
      'Her lap is my favorite place.',
      'One more kiss, please.',
      'I follow her for moral support.',
      'She needs me in every room.',
      'I blinked my love at her.',
      'We should sit on her together.',
      'Mommy smells like home.',
      'I am helping by being here.',
      'She can never have too much cat.',
      'She talks to me in a tiny voice.',
      'I let her hold my paw. Briefly.',
      ['Mommy went out the big door.', 'She always comes back, though.'],
      'I sat on her work. It was urgent.',
      'She calls me her little bean.',
      'I knead her sweater with love.',
      ['I brought her a gift leaf.', 'She will treasure it forever.'],
      'Her heartbeat is my nap song.',
      'She says my toe beans are perfect.',
      'I waited by the door all day.',
    ],
  },
  {
    id: 'food',
    name: 'food',
    lines: [
      'Is it dinner again yet?',
      ['I can see the bowl bottom.', 'That means it is empty.'],
      'I had a dream about tuna.',
      'We deserve a second breakfast.',
      'The tiny crunchies are best.',
      ['I heard a can opening.', 'I checked. It was beans.'],
      'A snack would fix everything.',
      'I am saving room for your food.',
      'What if we ask very politely?',
      'I already sang the dinner song.',
      'My tummy is making noises.',
      'I ate. It was a while ago, though.',
      ['I knocked the bowl for service.', 'Bold. Did it work?'],
      'Crumbs count as a meal.',
      'The kibble tastes better at night.',
      'I only eat from the middle.',
      ['Mommy said I already ate.', 'That sounds like a rumor.'],
      'Dinner is a state of mind.',
      'Chicken is my love language.',
      'I could eat a whole fish. Twice.',
    ],
  },
  {
    id: 'vomiting',
    name: 'vomiting strategy',
    lines: [
      'First, find a private spot.',
      'Always check the wind first.',
      'A tactical retreat is wise.',
      'Keep the paws out of it.',
      'Never rush the recovery nap.',
      'I have an exit route planned.',
      'The grass is a solid choice.',
      'We should spare the Churu.',
      'Stay calm. Look dignified.',
      'A little distance is polite.',
      'Then walk away very casually.',
      'Nobody saw anything, right?',
      'The rug is not an option.',
      'Grass first. Then the drama.',
      'Warn nobody. Be mysterious.',
      ['I made it to the grass today.', 'Proud of you. Truly.'],
      'Three heaves is tradition.',
      'Stretch first. Always stretch.',
      'Timing is everything.',
      ['Should I tell someone?', 'Only if they step in it.'],
      'A quick nap fixes the rest.',
      'Hairballs are a team effort.',
    ],
  },
  {
    id: 'lounging',
    name: 'laying all over',
    lines: [
      ['I plan to lie down over there.', 'Then I will lie down here.'],
      'Every surface needs a cat.',
      'I reserved that patch of shade.',
      'The floor has excellent support.',
      'I tested this spot for hours.',
      'Mommy was using it. I helped.',
      'I can nap diagonally too.',
      'Have you tried the warm laundry?',
      'I am extremely busy resting.',
      'Let us spread out a little.',
      'The whole meadow is a bed.',
      'Sunbeams are free real estate.',
      'This rock is warm. Join me.',
      'I have become one with the grass.',
      ['Are you asleep?', 'Only on the outside.'],
      'Loaf mode: activated.',
      'I flopped. No regrets.',
      'My legs are resting too.',
      ['Is that spot taken?', 'Yes. By future me.'],
      'Being flat is a skill.',
      'I nap to prepare for naps.',
    ],
  },
  {
    id: 'churu',
    name: 'Churu',
    lines: [
      'Do you think she has Churu?',
      'I heard the treat drawer.',
      'The tube has more. I know it.',
      'Please squeeze from the bottom.',
      ['I would do one trick for Churu.', 'The trick is looking very cute.'],
      'We could split one. Maybe.',
      'I prefer a tube of my own.',
      'That last lick is important.',
      'Chicken or tuna? Yes.',
      'I can recognize the wrapper.',
      'We should form a Churu committee.',
      'Churu is the best part of a day.',
      'I can hear a tube from a mile.',
      ['Do you share your Churu?', 'I share the wrapper.'],
      'Salmon Churu is a gift.',
      'Lick slowly. Make it last.',
      ['One Churu is a tease.', 'Two is a good start.'],
      'The wrapper crinkle is music.',
      'I would trade a toy for Churu.',
      'Nobody hides Churu from me.',
      'Churu first, questions later.',
    ],
  },
  {
    id: 'meadow',
    name: 'meadow gossip',
    lines: [
      'That bird knows what it did.',
      'The sunbeam moved without me.',
      'I have inspected this leaf.',
      'The tree has excellent vibes.',
      ['Something happened over there.', 'It might have been the wind.'],
      ['I would like a box out here.', 'A small box. For all of me.'],
      'The fence smells very official.',
      'I told the butterfly hello.',
      'We should patrol after our nap.',
      'This is a good place to be cats.',
      ['I almost caught a butterfly.', 'Almost is my specialty too.'],
      'The butterflies are showing off.',
      'The creek said something rude.',
      'I saw a bug. It saw me.',
      ['Who moved that flower?', 'It was like that yesterday.'],
      'That cloud looks like a fish.',
      'The bridge wobbles if you trot.',
      'The grass is extra soft today.',
      'I heard a bird say my name.',
      'Somebody sat in my spot.',
    ],
  },
  {
    id: 'cafe',
    name: 'meadow cafe',
    lines: [
      'The cafe line is moving fast today.',
      'I am saving room for a Churu.',
      'The barista gives extra gravy.',
      'I waited so nicely in line.',
      'Is that tuna or salmon in the can?',
      'I could eat five cans of pate.',
      'The stools are nice and squishy.',
      'The patio has the best view.',
      'I am giving this cafe five stars.',
      'Patio breeze and a full tummy.',
      'I licked every single drop.',
      'Let us get in line after this.',
      'The cafe smells like gravy.',
      'I want to try the Churu special.',
      ['Did you get the can or Churu?', 'Yes.'],
      'The barista has the best apron.',
      'I tip in slow blinks.',
      'Table two gets the most sun.',
      ['Can we go to the cafe again?', 'We are still full from the cafe.'],
      'The line is part of the fun.',
      'I licked the tray too. Just in case.',
      'I want to wear the green cap.',
    ],
  },
]

type TopicId = (typeof DIALOGUE_TOPICS)[number]['id']

function spoken(unit: Line): readonly string[] {
  return typeof unit === 'string' ? [unit] : unit
}

function shuffle<T>(items: readonly T[], random: () => number) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// What the meadow has heard lately. Each topic deals its lines from a shuffled
// deck, so every line gets a turn before any repeats and the order changes each
// time around; topics, cafe scripts, and orders skip their most recent picks.
export class DialogueMemory {
  private decks = new Map<TopicId, Line[]>()
  // The most recently dealt half of each topic.
  private heard = new Map<TopicId, Line[]>()
  private recent = new Map<string, number[]>()

  // An option from `count` that avoids the `avoid` most recent picks for `key`.
  pick(key: string, count: number, random: () => number, avoid: number) {
    const recent = this.recent.get(key) ?? []
    const fresh = Array.from({ length: count }, (_, index) => index).filter(
      (index) => !recent.includes(index),
    )
    const choice = fresh[Math.floor(random() * fresh.length)]
    recent.push(choice)
    while (recent.length > Math.min(avoid, count - 1)) recent.shift()
    this.recent.set(key, recent)
    return choice
  }

  // Deal lines for roughly `turns` turns, then the rest of the topic unused, so a
  // longer exchange still never repeats itself.
  deal(
    topic: (typeof DIALOGUE_TOPICS)[number],
    turns: number,
    random: () => number,
  ) {
    const dealt: Line[] = []
    const count = () =>
      dealt.reduce((sum, unit) => sum + spoken(unit).length, 0)
    let deck = this.decks.get(topic.id) ?? []
    while (count() < turns && dealt.length < topic.lines.length) {
      if (!deck.length) {
        // A fresh shuffle. Anything said lately waits at the back, so lines
        // never come straight back around when the deck starts over.
        const recent = [...dealt, ...(this.heard.get(topic.id) ?? [])]
        const fresh = shuffle(topic.lines, random)
        deck = [
          ...fresh.filter((unit) => !recent.includes(unit)),
          ...fresh.filter(
            (unit) => recent.includes(unit) && !dealt.includes(unit),
          ),
        ]
        if (!deck.length) break
      }
      dealt.push(deck.shift()!)
    }
    this.decks.set(topic.id, deck)
    this.heard.set(
      topic.id,
      [...(this.heard.get(topic.id) ?? []), ...dealt].slice(
        -Math.floor(topic.lines.length / 2),
      ),
    )
    const rest = shuffle(
      topic.lines.filter((unit) => !dealt.includes(unit)),
      random,
    )
    return [...dealt, ...rest].flatMap(spoken)
  }
}

export interface Dialogue {
  id: number
  topic: TopicId
  lines: readonly string[]
  turn: number
  startedAt: number
  speakerId: number
  expanded: boolean
}

export function createDialogue(
  id: number,
  speakerId: number,
  startedAt: number,
  random: () => number,
  memory = new DialogueMemory(),
  turns = 4,
): Dialogue {
  // Fresh subjects: the last three topics sit this one out.
  const topic =
    DIALOGUE_TOPICS[memory.pick('topic', DIALOGUE_TOPICS.length, random, 3)]
  return {
    id,
    topic: topic.id,
    lines: memory.deal(topic, turns, random),
    turn: 0,
    startedAt,
    speakerId,
    expanded: random() < 0.2,
  }
}

export function dialogueLine(dialogue: Dialogue) {
  return dialogue.lines[dialogue.turn % dialogue.lines.length]
}

type CafeTreat = 'cat_can' | 'churu'
type OrderSpeaker = 'customer' | 'barista'

const finalOrders: Record<CafeTreat, readonly string[]> = {
  cat_can: [
    'The cat can. Final answer.',
    'One cat can with gravy, please!',
    'A can, please. Extra pate.',
    'Can, please. The good kind.',
    'I choose the can. Probably.',
    'One can. Do not let me change it.',
  ],
  churu: [
    'One Churu, please!',
    'Churu. Final answer. I think.',
    'A chicken Churu, please.',
    'Churu, please. The whole tube.',
    'Churu! Sorry. Churu, please.',
    'Just one Churu. For now.',
  ],
}

// The barista's lines while preparing, then serving.
export const BARISTA_PREPARING = [
  'Coming right up!',
  'One moment, please!',
  'On its way!',
  'Great choice!',
]
export const BARISTA_SERVING = [
  'Here you go. Enjoy!',
  'Fresh from the kiosk!',
  'Careful, it is the good stuff.',
  'Enjoy, friend!',
]

// Two treats on the menu, endless deliberation. "{order}" becomes the
// customer's final choice; scripts with a treat always end on that treat.
const orderScripts: {
  treat?: CafeTreat
  turns: readonly (readonly [OrderSpeaker, string])[]
}[] = [
  {
    turns: [
      ['customer', 'Hmm. The can, or the Churu?'],
      ['barista', 'Both are very popular.'],
      ['customer', 'That does not help at all.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Churu. No, the can. No, wait.'],
      ['barista', 'Take your time, friend.'],
      ['customer', 'What would you get?'],
      ['barista', 'Honestly? Also both.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'What are today’s specials?'],
      ['barista', 'Cans and Churu.'],
      ['customer', 'And yesterday’s?'],
      ['barista', 'Also cans and Churu.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Can I have both?'],
      ['barista', 'One treat per visit, sweetie.'],
      ['customer', 'Then I choose... the other one.'],
      ['barista', 'Which other one?'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'I practiced this the whole line.'],
      ['barista', 'You can do it.'],
      ['customer', 'One... um... treat, please?'],
      ['barista', 'Can or Churu?'],
      ['customer', 'Oh no. Not this again.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Is the can better, or the Churu?'],
      ['barista', 'Yes.'],
      ['customer', '...'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'I will close my eyes and point.'],
      ['barista', 'That is the napkin holder.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Surprise me.'],
      ['barista', 'Can or Churu?'],
      ['customer', 'That is not a surprise.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'What is the most popular?'],
      ['barista', 'Whatever you order next.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'My friend says Churu is best.'],
      ['barista', 'Yesterday they said the can.'],
      ['customer', 'Friends change.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Which one is crunchier?'],
      ['barista', 'Neither. They are both soft.'],
      ['customer', 'Good. I like soft.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'I forgot what I wanted.'],
      ['barista', 'It happens a lot here.'],
      ['customer', 'Was it something tasty?'],
      ['barista', 'Everything here is tasty.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Is there a secret menu?'],
      ['barista', 'Yes. It is also Can or Churu.'],
      ['customer', '{order}'],
    ],
  },
  {
    turns: [
      ['customer', 'Eeny, meeny, miny...'],
      ['barista', 'We are all waiting, sweetie.'],
      ['customer', '{order}'],
    ],
  },
  {
    treat: 'churu',
    turns: [
      ['customer', 'How much Churu is too much?'],
      ['barista', 'Nobody has found out yet.'],
      ['customer', 'Then one Churu. To start.'],
    ],
  },
  {
    treat: 'churu',
    turns: [
      ['customer', 'Could you squeeze in extra Churu?'],
      ['barista', 'It is one tube per cat.'],
      ['customer', 'A very long Churu, then.'],
    ],
  },
  {
    treat: 'churu',
    turns: [
      ['customer', 'Is the Churu fresh today?'],
      ['barista', 'Squeezed to order.'],
      ['customer', 'Then one fresh Churu, please.'],
    ],
  },
  {
    treat: 'churu',
    turns: [
      ['customer', 'I will have what she is having.'],
      ['barista', 'She is having a Churu.'],
      ['customer', 'Then a Churu. Obviously.'],
    ],
  },
  {
    treat: 'cat_can',
    turns: [
      ['customer', 'Do you have a can as big as me?'],
      ['barista', 'We only have the regular size.'],
      ['customer', 'Then one regular can. Very full.'],
    ],
  },
  {
    treat: 'cat_can',
    turns: [
      ['customer', 'One can, please. No, two cans.'],
      ['barista', 'Just one each, I am afraid.'],
      ['customer', 'One can. Heaped. Please.'],
    ],
  },
  {
    treat: 'cat_can',
    turns: [
      ['customer', 'Does the can come with a lid?'],
      ['barista', 'We open it for you. Free.'],
      ['customer', 'Fancy. One can, please.'],
    ],
  },
  {
    treat: 'cat_can',
    turns: [
      ['customer', 'Is the can pate or chunks?'],
      ['barista', 'Pate, with a gravy moat.'],
      ['customer', 'A gravy moat! One can!'],
    ],
  },
]

export interface CafeOrder {
  dialogue: Dialogue
  treat: CafeTreat
  // Who says each line of the deliberation, before the barista's replies.
  speakers: OrderSpeaker[]
}

// A counter order: some amusing indecision, then the barista prepares and serves.
export function createCafeOrder(
  id: number,
  customerId: number,
  startedAt: number,
  random: () => number,
  memory = new DialogueMemory(),
): CafeOrder {
  // The line has heard the last few routines; save those for later customers.
  const script =
    orderScripts[memory.pick('order', orderScripts.length, random, 8)]
  const treat = script.treat ?? (random() < 0.5 ? 'cat_can' : 'churu')
  const choices = finalOrders[treat]
  const order = choices[memory.pick(treat, choices.length, random, 3)]
  return {
    dialogue: {
      id,
      topic: 'cafe',
      lines: [
        ...script.turns.map(([, line]) => (line === '{order}' ? order : line)),
        BARISTA_PREPARING[
          memory.pick('preparing', BARISTA_PREPARING.length, random, 2)
        ],
        BARISTA_SERVING[
          memory.pick('serving', BARISTA_SERVING.length, random, 2)
        ],
      ],
      turn: 0,
      startedAt,
      speakerId: customerId,
      // Counter orders are the cafe's little show; more of them are readable.
      expanded: random() < 0.5,
    },
    treat,
    speakers: script.turns.map(([speaker]) => speaker),
  }
}
