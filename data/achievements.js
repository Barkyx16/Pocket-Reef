// Achievement / badge definitions — 74 badges. Each `check` receives a computed
// state object (see core.getAchievements) aggregated across ALL tanks. Emoji
// badges keep it image-free.
export const ACHIEVEMENTS = [
  // ── Collection: species count ──
  { id: "first_species", emoji: "🐟", title: "First Fish", desc: "Add your first species.", check: (s) => s.species >= 1 },
  { id: "community", emoji: "🐠", title: "Community Tank", desc: "Keep 5 species in one tank.", check: (s) => s.maxTank >= 5 },
  { id: "species10", emoji: "🎣", title: "Collector", desc: "Keep 10 different species.", check: (s) => s.species >= 10 },
  { id: "species25", emoji: "🗂️", title: "Curator", desc: "Keep 25 different species.", check: (s) => s.species >= 25 },
  { id: "species50", emoji: "🏛️", title: "Aquarist Elite", desc: "Keep 50 different species.", check: (s) => s.species >= 50 },
  { id: "species100", emoji: "🌍", title: "Living Museum", desc: "Keep 100 different species.", check: (s) => s.species >= 100 },

  // ── Keep a kind ──
  { id: "reefer", emoji: "🪸", title: "Reefer", desc: "Add a coral.", check: (s) => s.coral },
  { id: "invert_keeper", emoji: "🦐", title: "Invert Keeper", desc: "Keep an invertebrate.", check: (s) => s.invert },
  { id: "shrimp_keeper", emoji: "🍤", title: "Shrimp Squad", desc: "Keep a shrimp.", check: (s) => s.shrimp },
  { id: "snail_keeper", emoji: "🐌", title: "Snail Mail", desc: "Keep a snail.", check: (s) => s.snail },
  { id: "crab_keeper", emoji: "🦀", title: "Crabby", desc: "Keep a crab.", check: (s) => s.crab },
  { id: "star_keeper", emoji: "⭐", title: "Superstar", desc: "Keep a starfish.", check: (s) => s.star },
  { id: "coral_garden", emoji: "🌸", title: "Coral Garden", desc: "Keep 3 corals.", check: (s) => s.corals >= 3 },
  { id: "reef_tank", emoji: "🏝️", title: "Reef Builder", desc: "Keep 5 corals.", check: (s) => s.corals >= 5 },

  // ── Signature species ──
  { id: "clownfish", emoji: "🤡", title: "Finding Nemo", desc: "Keep a clownfish.", check: (s) => s.clown },
  { id: "betta", emoji: "👑", title: "The King", desc: "Keep a betta.", check: (s) => s.betta },
  { id: "tang", emoji: "💙", title: "Just Keep Swimming", desc: "Keep a tang.", check: (s) => s.tang },
  { id: "angelfish", emoji: "😇", title: "Angel", desc: "Keep an angelfish.", check: (s) => s.angelfish },
  { id: "cichlid", emoji: "🎨", title: "Cichlid Fan", desc: "Keep a cichlid.", check: (s) => s.cichlid },
  { id: "pleco", emoji: "🧹", title: "Janitor", desc: "Keep a pleco.", check: (s) => s.pleco },
  { id: "gourami", emoji: "🫧", title: "Labyrinth", desc: "Keep a gourami.", check: (s) => s.gourami },
  { id: "tetra", emoji: "✨", title: "Schooler", desc: "Keep a tetra.", check: (s) => s.tetra },
  { id: "rasbora", emoji: "🔦", title: "Nano Nut", desc: "Keep a rasbora.", check: (s) => s.rasbora },
  { id: "rainbow", emoji: "🌈", title: "Rainbow Chaser", desc: "Keep a rainbowfish.", check: (s) => s.rainbow },
  { id: "goby", emoji: "🕳️", title: "Sand Sifter", desc: "Keep a goby.", check: (s) => s.goby },
  { id: "wrasse", emoji: "🐍", title: "Wrasse Wrangler", desc: "Keep a wrasse.", check: (s) => s.wrasse },
  { id: "blenny", emoji: "😜", title: "Comedian", desc: "Keep a blenny.", check: (s) => s.blenny },
  { id: "cardinal", emoji: "🃏", title: "Card Shark", desc: "Keep a cardinalfish.", check: (s) => s.cardinal },
  { id: "damsel", emoji: "😈", title: "Little Terror", desc: "Keep a damsel.", check: (s) => s.damsel },

  // ── Water types ──
  { id: "freshwater", emoji: "💧", title: "Freshwater Fan", desc: "Keep a freshwater species.", check: (s) => s.fresh },
  { id: "saltwater", emoji: "🌊", title: "Salt Life", desc: "Keep a saltwater species.", check: (s) => s.salt },
  { id: "both_worlds", emoji: "🌐", title: "Best of Both", desc: "Keep fresh and salt tanks.", check: (s) => s.both },

  // ── Multiple tanks ──
  { id: "two_tanks", emoji: "🔷", title: "Two's Company", desc: "Run 2 tanks.", check: (s) => s.tanks >= 2 },
  { id: "three_tanks", emoji: "🔶", title: "Fish Room", desc: "Run 3 tanks.", check: (s) => s.tanks >= 3 },
  { id: "five_tanks", emoji: "🏢", title: "Fish Empire", desc: "Run 5 tanks.", check: (s) => s.tanks >= 5 },
  { id: "big_tank", emoji: "📏", title: "Going Big", desc: "Have a 55 gal+ tank.", check: (s) => s.big },
  { id: "huge_tank", emoji: "🐋", title: "Whale Watcher", desc: "Have a 100 gal+ tank.", check: (s) => s.huge },

  // ── Testing & cycle ──
  { id: "first_test", emoji: "🧪", title: "Test Kit", desc: "Log your first water test.", check: (s) => s.tests >= 1 },
  { id: "diligent", emoji: "🔬", title: "Diligent", desc: "Log 10 water tests.", check: (s) => s.tests >= 10 },
  { id: "tests25", emoji: "📊", title: "Data Nerd", desc: "Log 25 water tests.", check: (s) => s.tests >= 25 },
  { id: "tests50", emoji: "📈", title: "Chemist", desc: "Log 50 water tests.", check: (s) => s.tests >= 50 },
  { id: "tests100", emoji: "⚗️", title: "Lab Coat", desc: "Log 100 water tests.", check: (s) => s.tests >= 100 },
  { id: "cycled", emoji: "🔄", title: "Cycled!", desc: "Fully cycle a tank.", check: (s) => s.cycled },
  { id: "perfect_water", emoji: "💎", title: "Pristine", desc: "Log a test with every reading in range.", check: (s) => s.perfect },

  // ── Journal & photos ──
  { id: "diarist", emoji: "📓", title: "Reef Diarist", desc: "Write your first journal entry.", check: (s) => s.journal >= 1 },
  { id: "journal10", emoji: "📔", title: "Storyteller", desc: "Write 10 journal entries.", check: (s) => s.journal >= 10 },
  { id: "journal25", emoji: "📚", title: "Chronicler", desc: "Write 25 journal entries.", check: (s) => s.journal >= 25 },
  { id: "first_photo", emoji: "📷", title: "Say Cheese", desc: "Add a journal photo.", check: (s) => s.photos >= 1 },
  { id: "photos10", emoji: "🖼️", title: "Photographer", desc: "Add 10 journal photos.", check: (s) => s.photos >= 10 },

  // ── Maintenance, costs, quarantine ──
  { id: "first_maint", emoji: "🧰", title: "Handy", desc: "Log a maintenance task.", check: (s) => s.maint >= 1 },
  { id: "maint_master", emoji: "🛠️", title: "Maintenance Master", desc: "Log all 4 maintenance types.", check: (s) => s.maint >= 4 },
  { id: "first_cost", emoji: "🧾", title: "Bookkeeper", desc: "Track a tank expense.", check: (s) => s.costs >= 1 },
  { id: "spend100", emoji: "💵", title: "Invested", desc: "Track $100 in expenses.", check: (s) => s.spend >= 100 },
  { id: "spend500", emoji: "💰", title: "All In", desc: "Track $500 in expenses.", check: (s) => s.spend >= 500 },
  { id: "quarantine", emoji: "⏳", title: "Safety First", desc: "Quarantine a new arrival.", check: (s) => s.quarantine },

  // ── Streaks, levels, XP ──
  { id: "streak3", emoji: "🔥", title: "On a Roll", desc: "Reach a 3-day streak.", check: (s) => s.streak >= 3 },
  { id: "streak7", emoji: "⚡", title: "Week Strong", desc: "Reach a 7-day streak.", check: (s) => s.streak >= 7 },
  { id: "streak14", emoji: "🌟", title: "Unstoppable", desc: "Reach a 14-day streak.", check: (s) => s.streak >= 14 },
  { id: "streak30", emoji: "🏅", title: "Dedicated", desc: "Reach a 30-day streak.", check: (s) => s.streak >= 30 },
  { id: "level3", emoji: "🎖️", title: "Hobbyist", desc: "Reach level 3.", check: (s) => s.level >= 3 },
  { id: "level5", emoji: "🏆", title: "Aquarist", desc: "Reach level 5.", check: (s) => s.level >= 5 },
  { id: "reefmaster", emoji: "👑", title: "Reef Master", desc: "Reach the top level.", check: (s) => s.level >= 7 },

  // ── Compatibility mastery ──
  { id: "peaceful", emoji: "🕊️", title: "Peaceable Kingdom", desc: "Keep 2+ species with zero conflicts.", check: (s) => s.cf >= 2 },
  { id: "harmony5", emoji: "☯️", title: "In Harmony", desc: "Keep 5+ species with zero conflicts.", check: (s) => s.cf >= 5 },
  { id: "harmony8", emoji: "🧘", title: "Perfect Balance", desc: "Keep 8+ species with zero conflicts.", check: (s) => s.cf >= 8 },

  // ── Wishlist ──
  { id: "wishlist1", emoji: "💛", title: "Dreaming Big", desc: "Save a species to your wishlist.", check: (s) => s.wishlist >= 1 },
  { id: "wishlist10", emoji: "📝", title: "Wish List", desc: "Save 10 species to your wishlist.", check: (s) => s.wishlist >= 10 },

  // ── Longevity: how long a tank has run ──
  { id: "veteran90", emoji: "🗓️", title: "Seasoned", desc: "Keep a tank running for 90 days.", check: (s) => s.tankAgeDays >= 90 },
  { id: "veteran365", emoji: "🎂", title: "Anniversary", desc: "Keep a tank running for a full year.", check: (s) => s.tankAgeDays >= 365 },

  // ── Husbandry: stocking counts & record-keeping ──
  { id: "proper_shoal", emoji: "🐟", title: "Proper Shoal", desc: "Keep a schooling species at its full group size.", check: (s) => s.shoal },
  { id: "shoalmaster", emoji: "🐠", title: "Shoal Master", desc: "Keep 3 species at full group size.", check: (s) => s.fullShoals >= 3 },
  { id: "big_school", emoji: "🌊", title: "Big School", desc: "Keep 10+ of a single species.", check: (s) => s.bigSchool },
  { id: "documented", emoji: "📝", title: "By the Book", desc: "Add notes to a tank.", check: (s) => s.documented },
  { id: "wishlist25", emoji: "⭐", title: "Big Dreams", desc: "Save 25 species to your wishlist.", check: (s) => s.wishlist >= 25 },

  // ── Feeding & reef chemistry ──
  { id: "first_feed", emoji: "🍤", title: "Feeding Time", desc: "Log your first feeding.", check: (s) => s.feedings >= 1 },
  { id: "feed25", emoji: "🍽️", title: "Head Chef", desc: "Log 25 feedings.", check: (s) => s.feedings >= 25 },
  { id: "reef_chemist", emoji: "⚗️", title: "Reef Chemist", desc: "Test alkalinity, calcium & magnesium together.", check: (s) => s.reefChem },

  // ── Aquascaping & full tanks ──
  { id: "aquascaper", emoji: "🏞️", title: "Aquascaper", desc: "Keep fish, inverts & coral in one tank.", check: (s) => s.trifecta },
  { id: "well_stocked", emoji: "🏙️", title: "Fully Stocked", desc: "Keep 8 species in one tank.", check: (s) => s.maxTank >= 8 },
  { id: "full_panel", emoji: "🔬", title: "Full Panel", desc: "Log a test measuring 5+ parameters.", check: (s) => s.fullPanel },
  { id: "nano_master", emoji: "🫙", title: "Nano Master", desc: "Keep 3+ species in a 10-gallon or smaller tank.", check: (s) => s.nanoMaster },

  // ── Reef Games: skill in the mini-games ──
  { id: "game_streak5", emoji: "🎯", title: "On a Roll", desc: "Hit a 5-answer streak in any Reef Game.", check: (s) => s.gameStreak >= 5 },
  { id: "game_streak10", emoji: "🔥", title: "Unstoppable", desc: "Hit a 10-answer streak in any Reef Game.", check: (s) => s.gameStreak >= 10 },
  { id: "game_streak20", emoji: "🧠", title: "Reef Savant", desc: "Hit a 20-answer streak in any Reef Game.", check: (s) => s.gameStreak >= 20 },
  { id: "game_blitz15", emoji: "⚡", title: "Quick Draw", desc: "Score 15+ in a 60-second Blitz.", check: (s) => s.gameBlitz >= 15 },
  { id: "game_blitz25", emoji: "🏅", title: "Blitz Champion", desc: "Score 25+ in a 60-second Blitz.", check: (s) => s.gameBlitz >= 25 },
];
