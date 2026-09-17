export interface EmojiPickerEmoji {
  /** The character itself. */
  emoji: string
  /** Short lower-case name, read out and searched. */
  name: string
  /** Extra search words. */
  keywords: string[]
  /** Category id, matching one of `EMOJI_PICKER_CATEGORIES`. */
  category: string
}

export interface EmojiPickerCategory {
  id: string
  label: string
  /** Emoji shown on the category tab. */
  icon: string
}

export const EMOJI_PICKER_CATEGORIES: EmojiPickerCategory[] = [
  { id: 'smileys', label: 'Smileys', icon: '😀' },
  { id: 'people', label: 'People', icon: '👋' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'activity', label: 'Activity', icon: '⚽' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', label: 'Symbols', icon: '❤️' },
]

// emoji|name|keywords, one per line, grouped by category. Kept as text because
// 200 object literals would be three times the size and no easier to edit.
const RAW: Record<string, string> = {
  smileys: `😀|grinning face|smile happy joy
😃|big smile|happy joy grin
😄|smiling eyes|happy laugh
😁|beaming face|grin teeth
😆|laughing|lol haha
😅|sweat smile|relief nervous
🤣|rolling on the floor|lol laugh rofl
😂|tears of joy|lol laugh cry
🙂|slight smile|ok fine
😉|wink|flirt joke
😊|blush|happy shy
😇|halo|angel innocent
🥰|smiling with hearts|love adore
😍|heart eyes|love crush
🤩|star struck|wow amazing
😘|blowing a kiss|love kiss
😋|yum|tasty delicious
😛|tongue out|playful
🤪|zany face|crazy silly
🤔|thinking|hmm wonder
🤨|raised eyebrow|skeptical doubt
😐|neutral face|meh blank
🙄|eye roll|whatever annoyed
😏|smirk|smug
😬|grimace|awkward yikes
😌|relieved|calm content
😴|sleeping|tired zzz
🤯|mind blown|shocked wow
🥳|party face|celebrate birthday
😎|cool sunglasses|chill
🤓|nerd|geek glasses
😕|confused|unsure
😮|open mouth|surprised wow
😢|crying|sad tear
😭|sobbing|sad cry
😤|huffing|frustrated triumph
😡|angry|mad rage
🥺|pleading|puppy eyes please
😱|screaming|scared shock
🤗|hug|hugging warm
🫠|melting|embarrassed heat
🤐|zipper mouth|secret quiet
🥲|smile with tear|grateful bittersweet
🤢|nauseated|sick gross
🤒|thermometer face|ill sick`,
  people: `👋|waving hand|hello hi bye
👍|thumbs up|yes approve like
👎|thumbs down|no dislike
👏|clapping|applause bravo
🙌|raised hands|celebrate hooray
🙏|folded hands|please thanks pray
🤝|handshake|deal agree
✌️|victory|peace
🤞|crossed fingers|luck hope
👌|ok hand|perfect fine
🤙|call me|shaka hang loose
💪|flexed biceps|strong muscle
👀|eyes|look watching
🧠|brain|smart think
🫶|heart hands|love care
✍️|writing hand|write sign
👉|pointing right|this that
☝️|index up|one point
🤷|shrug|dunno whatever
🙋|raising hand|question me
🧑‍💻|technologist|developer coder laptop
🧑‍🎨|artist|designer paint
🕺|dancing|dance party
🏃|running|run exercise`,
  nature: `🐶|dog|puppy pet
🐱|cat|kitten pet
🦊|fox|animal
🐻|bear|animal
🐼|panda|animal
🐨|koala|animal
🦁|lion|animal king
🐸|frog|animal
🐵|monkey|animal
🐧|penguin|animal bird
🦉|owl|bird wise
🐝|bee|honey insect
🦋|butterfly|insect pretty
🐢|turtle|slow
🐙|octopus|sea
🐳|whale|sea ocean
🌸|cherry blossom|flower spring
🌻|sunflower|flower summer
🌹|rose|flower love
🌵|cactus|desert plant
🌲|evergreen tree|forest pine
🌿|herb|plant leaf green
🍀|four leaf clover|luck
🍁|maple leaf|autumn fall
🌈|rainbow|weather pride
☀️|sun|weather sunny
🌙|crescent moon|night
⭐|star|night
❄️|snowflake|cold winter
🔥|fire|hot lit flame
🌊|wave|ocean sea water
⚡|lightning|zap electric power`,
  food: `🍎|red apple|fruit
🍌|banana|fruit
🍓|strawberry|fruit
🍉|watermelon|fruit summer
🍋|lemon|fruit sour
🥑|avocado|fruit green
🍕|pizza|slice food
🍔|burger|hamburger food
🌮|taco|mexican food
🍣|sushi|japanese food
🍜|noodles|ramen soup
🥐|croissant|bread breakfast
🥗|salad|healthy green
🍩|doughnut|donut sweet
🍪|cookie|biscuit sweet
🎂|birthday cake|party sweet
🍫|chocolate|sweet
🍿|popcorn|movie snack
☕|coffee|hot drink morning
🍵|tea|hot drink
🍺|beer|drink cheers
🍷|wine|drink
🥂|clinking glasses|cheers toast celebrate
🧃|juice box|drink`,
  activity: `⚽|football|soccer sport
🏀|basketball|sport
🎾|tennis|sport
🏈|american football|sport
⚾|baseball|sport
🏓|ping pong|table tennis sport
🎯|bullseye|target goal dart
🎮|video game|controller play
🎲|die|dice game chance
♟️|chess pawn|strategy game
🎨|palette|art paint design
🎸|guitar|music rock
🎧|headphones|music listen
🎬|clapper board|film movie
🏆|trophy|win award champion
🥇|gold medal|first win
🎉|party popper|celebrate tada congrats
🎁|gift|present birthday`,
  travel: `✈️|airplane|flight travel
🚀|rocket|launch ship space
🚗|car|drive
🚲|bicycle|bike cycle
🚆|train|rail travel
⛵|sailboat|sea boat
🗺️|world map|travel
🏔️|mountain|snow hike
🏖️|beach|holiday vacation
🏠|house|home
🏢|office building|work
🌍|globe|earth world
🧭|compass|direction navigate
⛺|tent|camping outdoors`,
  objects: `💡|light bulb|idea
💻|laptop|computer work
📱|phone|mobile
⌨️|keyboard|type
🖥️|desktop computer|screen monitor
📷|camera|photo
📚|books|read library study
📝|memo|note write
📌|pushpin|pin location
📎|paperclip|attach
✂️|scissors|cut
🔒|lock|secure private
🔑|key|password access
🔔|bell|notification alert
📦|package|box ship delivery
📅|calendar|date schedule
⏰|alarm clock|time wake
💰|money bag|cash rich
💳|credit card|payment
🛠️|tools|build fix
🧪|test tube|experiment science
🔍|magnifying glass|search find zoom
📈|chart up|growth trend increase
📉|chart down|decline decrease`,
  symbols: `❤️|red heart|love
🧡|orange heart|love
💛|yellow heart|love
💚|green heart|love
💙|blue heart|love
💜|purple heart|love
🖤|black heart|love
💔|broken heart|sad breakup
💯|hundred points|perfect score
✅|check mark|done yes complete
❌|cross mark|no wrong
⚠️|warning|caution alert
❓|question mark|help what
❗|exclamation|important
✨|sparkles|shiny new magic
💬|speech bubble|chat comment message
➕|plus|add
♻️|recycle|green environment
🆕|new button|new
🔴|red circle|record live`,
}

/** The built-in set: about 200 common emoji with names and search words. */
export const EMOJI_PICKER_DATA: EmojiPickerEmoji[] = Object.entries(RAW).flatMap(([category, block]) =>
  block.split('\n').map((line) => {
    const [emoji, name, words = ''] = line.split('|')
    return { emoji, name, keywords: words.split(' ').filter(Boolean), category }
  }),
)
