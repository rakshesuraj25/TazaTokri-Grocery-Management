/**
 * Comprehensive multilingual & phonetic synonym dictionary for all 36 TazaTokri catalog vegetables.
 *
 * Covers:
 * - English names & culinary aliases
 * - Marathi (देवनागरी) names & regional variants
 * - Hindi (देवनागरी) names & regional variants
 * - Common Indian Roman/Latin transliterations
 * - Phonetic & everyday spelling variations
 */

export interface VegetableSynonymEntry {
  readonly slug: string
  readonly nameEn: string
  readonly marathi: readonly string[]
  readonly hindi: readonly string[]
  readonly transliterations: readonly string[]
  readonly phoneticVariants: readonly string[]
}

export const VEGETABLE_SYNONYM_ENTRIES: Readonly<Record<string, VegetableSynonymEntry>> = {
  amaranth: {
    slug: 'amaranth',
    nameEn: 'Amaranth (Math)',
    marathi: ['माठ', 'लाल माठ', 'तांदुळजा', 'माठाची भाजी'],
    hindi: ['चौलाई', 'लाल चौलाई', 'चौलाई साग', 'रामदाना'],
    transliterations: ['math', 'maath', 'lal math', 'lal maath', 'chaulai', 'chawli bhaji', 'tandulja', 'amaranth leaves'],
    phoneticVariants: ['maat', 'choulai', 'chaulayi', 'cholai', 'amaranthus'],
  },
  beetroot: {
    slug: 'beetroot',
    nameEn: 'Beetroot',
    marathi: ['बीट', 'बीटरूट'],
    hindi: ['चुकंदर', 'चुकन्दर', 'बीटरूट'],
    transliterations: ['beet', 'beet root', 'chukandar', 'chukander', 'bitroot'],
    phoneticVariants: ['chukundar', 'chookandar', 'bit', 'beets'],
  },
  'bitter-gourd': {
    slug: 'bitter-gourd',
    nameEn: 'Bitter Gourd (Karela)',
    marathi: ['कारले', 'कारली', 'कारलं'],
    hindi: ['करेला', 'करेले'],
    transliterations: ['karela', 'karle', 'karli', 'karla', 'bitter melon', 'bitter gourd'],
    phoneticVariants: ['karella', 'karele', 'karlya', 'bittergourd'],
  },
  'bottle-gourd': {
    slug: 'bottle-gourd',
    nameEn: 'Bottle Gourd (Dudhi)',
    marathi: ['दुधी भोपळा', 'दुधी', 'दुधीभोपळा'],
    hindi: ['लौकी', 'घीया', 'दूधी'],
    transliterations: ['dudhi', 'doodhi', 'dudhi bhopla', 'lauki', 'ghiya', 'calabash', 'bottle gourd'],
    phoneticVariants: ['lowki', 'lauky', 'doodhy', 'ghia', 'bottlegourd'],
  },
  brinjal: {
    slug: 'brinjal',
    nameEn: 'Brinjal (Vangi)',
    marathi: ['वांगी', 'वांगे', 'वांगं', 'भरताची वांगी'],
    hindi: ['बैंगन', 'बैगन', 'भर्ता बैंगन'],
    transliterations: ['vangi', 'vange', 'wangi', 'wange', 'baingan', 'baigan', 'eggplant', 'aubergine', 'bharit'],
    phoneticVariants: ['vaangi', 'vaange', 'bangan', 'bengan', 'brinjel', 'ringan'],
  },
  cabbage: {
    slug: 'cabbage',
    nameEn: 'Cabbage',
    marathi: ['कोबी', 'पानकोबी', 'पत्ता कोबी'],
    hindi: ['पत्ता गोभी', 'बंद गोभी', 'पत्तागोभी', 'बंदगोभी'],
    transliterations: ['kobi', 'patta gobhi', 'patta gobi', 'band gobhi', 'band gobi', 'pankobi', 'green cabbage'],
    phoneticVariants: ['kobee', 'pattagobhi', 'pattagobi', 'bandgobhi', 'cabage', 'cabbge'],
  },
  capsicum: {
    slug: 'capsicum',
    nameEn: 'Capsicum',
    marathi: ['ढोबळी मिरची', 'सिमला मिरची', 'भोपळी मिरची'],
    hindi: ['शिमला मिर्च', 'सिमला मिर्च'],
    transliterations: ['shimla mirch', 'simla mirch', 'dhobali mirchi', 'dhobli mirchi', 'bell pepper', 'green pepper', 'sweet pepper'],
    phoneticVariants: ['shimla mirchi', 'simla mirchi', 'dhobli', 'capsikam', 'kapsikum'],
  },
  carrot: {
    slug: 'carrot',
    nameEn: 'Carrot (Gajar)',
    marathi: ['गाजर'],
    hindi: ['गाजर'],
    transliterations: ['gajar', 'gaajar', 'carrots'],
    phoneticVariants: ['gajjar', 'carot', 'karrot'],
  },
  cauliflower: {
    slug: 'cauliflower',
    nameEn: 'Cauliflower',
    marathi: ['फुलकोबी', 'फ्लॉवर', 'फूलकोबी'],
    hindi: ['फूलगोभी', 'फूल गोभी', 'गोभी'],
    transliterations: ['phool gobhi', 'phool gobi', 'fulkobi', 'phulkobi', 'flower', 'gobi', 'gobhi'],
    phoneticVariants: ['fulgobi', 'fulgobhi', 'phoolgobhi', 'flawar', 'coliflower', 'cauliflour'],
  },
  'cluster-beans': {
    slug: 'cluster-beans',
    nameEn: 'Cluster Beans (Gawar)',
    marathi: ['गवार', 'गवारी', 'गावठी गवार'],
    hindi: ['ग्वार फली', 'ग्वार', 'गवार फली'],
    transliterations: ['gawar', 'gavar', 'guar', 'gawar phali', 'gavar phali', 'cluster beans'],
    phoneticVariants: ['gavaar', 'gawaar', 'guwar', 'gavarfali', 'gawarfali'],
  },
  cucumber: {
    slug: 'cucumber',
    nameEn: 'Cucumber',
    marathi: ['काकडी', 'हिरवी काकडी'],
    hindi: ['खीरा', 'ककड़ी'],
    transliterations: ['kakdi', 'kakadi', 'kheera', 'khira', 'cucumbers'],
    phoneticVariants: ['kaakdi', 'khera', 'kukumbar', 'cucmber'],
  },
  'curry-leaves': {
    slug: 'curry-leaves',
    nameEn: 'Curry Leaves',
    marathi: ['कढीपत्ता', 'कढी पत्ता', 'कडीपत्ता'],
    hindi: ['करी पत्ता', 'कढ़ी पत्ता', 'मीठा नीम'],
    transliterations: ['kadi patta', 'kadipatta', 'kadhi patta', 'kadhipatta', 'kari patta', 'karipatta', 'meetha neem', 'sweet neem'],
    phoneticVariants: ['kaddipatta', 'kadipata', 'kurry leaves', 'curry patta'],
  },
  'dill-leaves': {
    slug: 'dill-leaves',
    nameEn: 'Dill Leaves (Shepu)',
    marathi: ['शेपू', 'शेपूची भाजी'],
    hindi: ['सोया साग', 'सोया', 'सुवा भाजी', 'सोआ'],
    transliterations: ['shepu', 'shepoo', 'suva', 'soya', 'soya saag', 'dill', 'dill herb'],
    phoneticVariants: ['sepu', 'shepu bhaji', 'suwa', 'sowa'],
  },
  drumstick: {
    slug: 'drumstick',
    nameEn: 'Drumstick (Shevga)',
    marathi: ['शेवगा', 'शेवग्याच्या शेंगा', 'शेवगा शेंग'],
    hindi: ['सहजन', 'मोरिंगा', 'सहजन की फली', 'मुनगा'],
    transliterations: ['shevga', 'shevgyachya shenga', 'sahjan', 'sehjan', 'moringa', 'munga', 'drumsticks'],
    phoneticVariants: ['shewga', 'sevga', 'sahajan', 'drum stick'],
  },
  fenugreek: {
    slug: 'fenugreek',
    nameEn: 'Fenugreek (Methi)',
    marathi: ['मेथी', 'मेथीची भाजी'],
    hindi: ['मेथी', 'हरी मेथी', 'मेथी साग'],
    transliterations: ['methi', 'methee', 'methi bhaji', 'methi saag', 'fenugreek leaves'],
    phoneticVariants: ['maithi', 'methy', 'fenugrik'],
  },
  'french-beans': {
    slug: 'french-beans',
    nameEn: 'French Beans',
    marathi: ['फरसबी', 'श्रावण घेवडा', 'बीन'],
    hindi: ['फ्रेंच बीन्स', 'बीन्स', 'फरासबीन', 'हरी फली'],
    transliterations: ['farasbi', 'fanasbi', 'pharasbi', 'shravan ghevda', 'beans', 'green beans', 'string beans', 'haricot beans'],
    phoneticVariants: ['farasbee', 'farashbi', 'frenchbeans', 'bin', 'bins'],
  },
  'fresh-coriander': {
    slug: 'fresh-coriander',
    nameEn: 'Fresh Coriander',
    marathi: ['कोथिंबीर', 'कोथिंबीर जुडी', 'धणे पान'],
    hindi: ['धनिया', 'हरा धनिया', 'धनिया पत्ती'],
    transliterations: ['kothimbir', 'kothimbeer', 'kotimbir', 'dhaniya', 'dhania', 'hara dhaniya', 'coriander', 'cilantro', 'coriander leaves'],
    phoneticVariants: ['kothmir', 'kothambir', 'kotmir', 'dhanya', 'daniya', 'koriander'],
  },
  garlic: {
    slug: 'garlic',
    nameEn: 'Garlic (Lasun)',
    marathi: ['लसूण', 'लसुण'],
    hindi: ['लहसुन', 'लहसून'],
    transliterations: ['lasun', 'lasoon', 'lahsun', 'lehsun', 'lahsoon'],
    phoneticVariants: ['lassun', 'lesun', 'garlik'],
  },
  ginger: {
    slug: 'ginger',
    nameEn: 'Ginger (Ale)',
    marathi: ['आले', 'आलं'],
    hindi: ['अदरक', 'आदी'],
    transliterations: ['ale', 'aale', 'ala', 'adrak', 'adarak', 'fresh ginger'],
    phoneticVariants: ['adrakh', 'aadarak', 'jinger', 'ginjer'],
  },
  'green-chilli': {
    slug: 'green-chilli',
    nameEn: 'Green Chilli (Mirchi)',
    marathi: ['हिरवी मिरची', 'मिरची', 'मिरच्या'],
    hindi: ['हरी मिर्च', 'मिर्च', 'मिर्ची'],
    transliterations: ['mirchi', 'mirch', 'hari mirch', 'hirvi mirchi', 'green chili', 'green chillies', 'chili', 'chilli'],
    phoneticVariants: ['mirchee', 'harimirch', 'hirvimirchi', 'chilly'],
  },
  'green-peas': {
    slug: 'green-peas',
    nameEn: 'Green Peas (Matar)',
    marathi: ['हिरवे मटार', 'मटार', 'वाटाणा', 'हिरवा वाटाणा'],
    hindi: ['हरी मटर', 'मटर', 'मटर फली'],
    transliterations: ['matar', 'mattar', 'hari matar', 'watana', 'vatana', 'hirva watana', 'peas', 'fresh peas'],
    phoneticVariants: ['muttar', 'mutter', 'waatana', 'vaatana', 'greenpeas'],
  },
  lemon: {
    slug: 'lemon',
    nameEn: 'Lemon (Limbu)',
    marathi: ['लिंबू', 'लिंबे'],
    hindi: ['नींबू', 'निम्बू'],
    transliterations: ['limbu', 'limboo', 'nimbu', 'nimboo', 'neembu', 'lime', 'lemons'],
    phoneticVariants: ['leembu', 'nimbu', 'lebu', 'nimu'],
  },
  mint: {
    slug: 'mint',
    nameEn: 'Mint (Pudina)',
    marathi: ['पुदिना', 'पुदीना'],
    hindi: ['पुदीना', 'पुदिना'],
    transliterations: ['pudina', 'pudeena', 'mint leaves', 'peppermint'],
    phoneticVariants: ['poodina', 'podina', 'phudina'],
  },
  okra: {
    slug: 'okra',
    nameEn: 'Okra (Bhendi)',
    marathi: ['भेंडी', 'भेंड्या'],
    hindi: ['भिंडी', 'भिन्डी'],
    transliterations: ['bhendi', 'bhindi', 'lady finger', 'ladies finger', 'ladyfinger'],
    phoneticVariants: ['bhendee', 'bhindee', 'bindi', 'bendi', 'vendakkai'],
  },
  onion: {
    slug: 'onion',
    nameEn: 'Onion (Kanda)',
    marathi: ['कांदा', 'कांदे', 'लाल कांदा'],
    hindi: ['प्याज', 'प्याज़', 'कांदा'],
    transliterations: ['kanda', 'kande', 'pyaz', 'pyaaz', 'pyaj', 'red onion', 'onions'],
    phoneticVariants: ['kaanda', 'kandaa', 'piyaz', 'piyaj', 'onyan'],
  },
  potato: {
    slug: 'potato',
    nameEn: 'Potato (Batata)',
    marathi: ['बटाटा', 'बटाटे'],
    hindi: ['आलू', 'आलु'],
    transliterations: ['batata', 'batate', 'aloo', 'alu', 'aalu', 'potatoes'],
    phoneticVariants: ['bataata', 'batattaa', 'allu', 'patato'],
  },
  pumpkin: {
    slug: 'pumpkin',
    nameEn: 'Pumpkin (Bhopla)',
    marathi: ['भोपळा', 'लाल भोपळा', 'काशी भोपळा', 'तांबडा भोपळा'],
    hindi: ['कद्दू', 'सीताफल', 'पेठा', 'लाल कद्दू'],
    transliterations: ['bhopla', 'bhopala', 'lal bhopla', 'tambda bhopla', 'kaddu', 'kadoo', 'sitaphal', 'yellow pumpkin'],
    phoneticVariants: ['bhoplya', 'kaddoo', 'kadhu', 'pampkin'],
  },
  radish: {
    slug: 'radish',
    nameEn: 'Radish (Mula)',
    marathi: ['मुळा', 'पांढरा मुळा'],
    hindi: ['मूली', 'मुली'],
    transliterations: ['mula', 'mooli', 'muli', 'white radish', 'daikon'],
    phoneticVariants: ['moola', 'moolee', 'raddish'],
  },
  'raw-banana': {
    slug: 'raw-banana',
    nameEn: 'Raw Banana (Kaccha Kela)',
    marathi: ['कच्ची केळी', 'कच्चे केळे', 'केळी'],
    hindi: ['कच्चा केला', 'कच्चे केले'],
    transliterations: ['kaccha kela', 'kachcha kela', 'kacchi keli', 'raw plantain', 'green banana', 'plantain'],
    phoneticVariants: ['kacha kela', 'kachha kela', 'kachi keli', 'rawbanana'],
  },
  'ridge-gourd': {
    slug: 'ridge-gourd',
    nameEn: 'Ridge Gourd (Dodka)',
    marathi: ['दोडका', 'दोडके', 'शिराळे'],
    hindi: ['तुरई', 'तोरी', 'तोरई'],
    transliterations: ['dodka', 'dodke', 'shirale', 'turai', 'tori', 'torai', 'turia', 'ridge gourd'],
    phoneticVariants: ['dodaka', 'toori', 'turayi', 'ridgegourd'],
  },
  spinach: {
    slug: 'spinach',
    nameEn: 'Spinach (Palak)',
    marathi: ['पालक', 'पालक भाजी'],
    hindi: ['पालक', 'पालक साग'],
    transliterations: ['palak', 'paalak', 'palak bhaji', 'palak saag', 'spinach leaves'],
    phoneticVariants: ['palk', 'palakh', 'spinich'],
  },
  'spring-onion': {
    slug: 'spring-onion',
    nameEn: 'Spring Onion',
    marathi: ['पातीचा कांदा', 'कांद्याची पात', 'कांदा पात'],
    hindi: ['हरा प्याज', 'हरी प्याज', 'प्याज की पत्ती'],
    transliterations: ['paticha kanda', 'kanda pat', 'kanda paat', 'kandyachi pat', 'hara pyaz', 'hara pyaaz', 'scallion', 'green onion'],
    phoneticVariants: ['springonion', 'harapyaz', 'kandapat', 'scallions'],
  },
  'sweet-corn': {
    slug: 'sweet-corn',
    nameEn: 'Sweet Corn',
    marathi: ['स्वीट कॉर्न', 'मका', 'मक्याचे कणीस', 'कणीस'],
    hindi: ['स्वीट कॉर्न', 'भुट्टा', 'मक्का', 'मकई'],
    transliterations: ['sweet corn', 'makka', 'maka', 'bhutta', 'kanis', 'kanees', 'corn', 'corn cob', 'maize'],
    phoneticVariants: ['sweetcorn', 'bhuta', 'makai', 'korn'],
  },
  'sweet-potato': {
    slug: 'sweet-potato',
    nameEn: 'Sweet Potato (Ratale)',
    marathi: ['रताळे', 'रताळी', 'रताळं'],
    hindi: ['शकरकंद', 'शकरकंदी', 'शकरकन्द'],
    transliterations: ['ratale', 'ratali', 'ratalu', 'shakarkand', 'shakarkandi', 'shakar kand', 'sweet potato'],
    phoneticVariants: ['rataale', 'sakarkand', 'shakarkhand', 'sweetpotato'],
  },
  tomato: {
    slug: 'tomato',
    nameEn: 'Tomato',
    marathi: ['टोमॅटो', 'टमाटा', 'टमाटे'],
    hindi: ['टमाटर', 'टमाटर देसी'],
    transliterations: ['tamatar', 'tamata', 'tamate', 'tomatoes', 'tamaatar'],
    phoneticVariants: ['tamater', 'tomatto', 'tometo'],
  },
  yam: {
    slug: 'yam',
    nameEn: 'Yam (Suran)',
    marathi: ['सुरण'],
    hindi: ['जिमीकंद', 'सूरन', 'ओल'],
    transliterations: ['suran', 'sooran', 'jimikand', 'zimikand', 'ol', 'elephant foot yam'],
    phoneticVariants: ['suvarn', 'jimmikand', 'suran yam'],
  },
}

/**
 * Flattened lookup of all search terms per vegetable slug.
 */
export const VEGETABLE_SYNONYMS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(VEGETABLE_SYNONYM_ENTRIES).map(([slug, entry]) => [
    slug,
    Array.from(
      new Set([
        entry.nameEn,
        ...entry.marathi,
        ...entry.hindi,
        ...entry.transliterations,
        ...entry.phoneticVariants,
      ]),
    ),
  ]),
)
