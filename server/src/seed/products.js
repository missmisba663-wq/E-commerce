const fs = require('fs');
const path = require('path');

// Photos live in client/public/images, and credits.json records who took each one and under what licence.
const CREDITS_FILE = path.join(__dirname, '..', '..', '..', 'client', 'public', 'images', 'credits.json');
const credits = fs.existsSync(CREDITS_FILE) ? JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8')) : [];

function photo(slug) {
  const file = `/images/products/${slug}.jpg`;
  const credit = credits.find((c) => c.file === file);
  if (!credit) return {};
  return { imageUrl: file, imageCredit: { author: credit.author, license: credit.license, source: credit.source } };
}

const product = (slug, fields) => ({ slug, ...photo(slug), ...fields });

// Prices are in pence.
module.exports = [
  product('monstera-deliciosa', {
    name: 'Monstera Deliciosa',
    category: 'plants',
    price: 3200,
    stock: 14,
    description:
      'The Swiss cheese plant. Give it bright, indirect light and something to climb, and it will happily take over a corner. The splits in the leaves get more dramatic as it matures. Arrives around 60cm tall in a 17cm nursery pot.',
    care: { light: 'Bright, indirect. Keep it out of harsh midday sun', water: 'When the top 5cm of soil is dry', petSafe: false },
  }),
  product('snake-plant-laurentii', {
    name: 'Snake Plant Laurentii',
    category: 'plants',
    price: 1850,
    stock: 22,
    description:
      "As close to unkillable as a houseplant gets. Upright, gold-edged leaves that cope with dim corners and forgotten waterings, and still look sharp. If you've never kept a plant alive before, start here.",
    care: { light: 'Anything from a shady corner to a bright window', water: 'Every 2 to 3 weeks, less in winter', petSafe: false },
  }),
  product('golden-pothos', {
    name: 'Golden Pothos',
    category: 'plants',
    price: 1200,
    stock: 30,
    description:
      'Heart-shaped leaves splashed with gold, on stems that trail beautifully off a shelf. It grows fast and forgives a lot. Snip a stem, pop it in water, and in a few weeks you have a new plant to give a friend.',
    care: { light: 'Low to bright, indirect light', water: 'When the top few centimetres feel dry', petSafe: false },
  }),
  product('calathea-orbifolia', {
    name: 'Calathea Orbifolia',
    category: 'plants',
    price: 2400,
    stock: 4,
    description:
      'Big, round leaves painted with silver stripes that fold up at night like they are going to sleep. A bit of a diva: it wants humidity, steady warmth and no cold draughts. Worth every bit of the effort.',
    care: { light: 'Medium, indirect. Direct sun scorches the leaves', water: 'Keep lightly moist, using rain or filtered water', petSafe: true },
  }),
  product('fiddle-leaf-fig', {
    name: 'Fiddle Leaf Fig',
    category: 'plants',
    price: 4500,
    stock: 6,
    description:
      "The statement tree, with big, glossy, violin-shaped leaves. Find it a bright spot and then leave it be, because fiddle leaves sulk when they're moved. Supplied at roughly 90cm tall.",
    care: { light: 'Bright light. A little morning sun is welcome', water: 'When the top 5cm is dry. It hates soggy roots', petSafe: false },
  }),
  product('string-of-pearls', {
    name: 'String of Pearls',
    category: 'plants',
    price: 1450,
    stock: 0,
    description:
      "A succulent with little bead-like leaves on long, trailing stems. It's gorgeous in a hanging pot. Let it dry out completely between waterings and give it your brightest window.",
    care: { light: 'Bright, with some direct sun', water: 'Only once the soil is completely dry', petSafe: false },
  }),
  product('zz-plant', {
    name: 'ZZ Plant',
    category: 'plants',
    price: 2100,
    stock: 18,
    description:
      'Glossy, upright and remarkably forgiving. It stores water in chunky roots under the soil, so a month away on holiday is no problem at all. Great for offices.',
    care: { light: 'Low to bright, indirect light', water: 'Every 3 to 4 weeks', petSafe: false },
  }),
  product('terracotta-pot-small', {
    name: 'Terracotta Pot - Small',
    category: 'pots',
    price: 650,
    stock: 40,
    description:
      "Classic unglazed terracotta with a drainage hole and a matching saucer. The clay breathes, so roots stay healthy and it's hard to overwater. 12cm across, and it gets a lovely weathered look over time.",
  }),
  product('blue-glazed-stoneware-planter', {
    name: 'Blue Glazed Stoneware Planter',
    category: 'pots',
    price: 2800,
    stock: 9,
    description:
      'A deep blue glaze that shifts colour in the light, on a simple flared shape. Every one is glazed by hand, so no two look quite the same. 18cm wide, which fits most 17cm nursery pots.',
  }),
  product('hand-woven-basket-planter', {
    name: 'Hand-Woven Basket Planter',
    category: 'pots',
    price: 1900,
    stock: 3,
    description:
      'Tightly woven natural seagrass that softens a room and makes a floor plant feel at home. Comes with a waterproof liner, so you can drop the nursery pot straight in.',
  }),
  product('hanging-macrame-planter', {
    name: 'Hanging Macrame Planter',
    category: 'pots',
    price: 1500,
    stock: 12,
    description:
      'Knotted by hand from soft cotton cord, in the spirit of the 1970s porches that made macramé famous. Fits pots up to 15cm. Best of all with a pothos or string of pearls trailing from it.',
  }),
  product('enamel-watering-can', {
    name: 'Enamel Watering Can',
    category: 'tools',
    price: 3400,
    stock: 7,
    description:
      'A sturdy steel can in a deep teal enamel, with a long spout that reaches under leaves without splashing the floor. Holds 1.5 litres. It looks good enough to leave out on the windowsill.',
  }),
  product('classic-bypass-secateurs', {
    name: 'Classic Bypass Secateurs',
    category: 'tools',
    price: 1600,
    stock: 15,
    description:
      "Sharp bypass blades for clean cuts on stems and roots, so your plants heal quickly. Spring-loaded, with a safety catch. They'll last for years if you wipe them down after use.",
  }),
  product('plant-mister-spray-bottle', {
    name: 'Plant Mister Spray Bottle',
    category: 'tools',
    price: 650,
    stock: 25,
    description:
      'A simple 500ml mister with an adjustable nozzle, from a fine mist to a jet. Handy for humidity lovers like calatheas and ferns, and for wiping dust off big leaves.',
  }),
  product('all-purpose-liquid-feed', {
    name: 'All-Purpose Liquid Feed',
    category: 'care',
    price: 850,
    stock: 50,
    description:
      'A balanced, peat-free feed for leafy houseplants. Add one capful to a watering can every two weeks from spring to autumn, then give it a rest over winter.',
  }),
  product('chunky-aroid-potting-mix', {
    name: 'Chunky Aroid Potting Mix',
    category: 'care',
    price: 1250,
    stock: 2,
    description:
      'Bark, perlite, coir and charcoal, mixed by hand in our potting shed for monsteras, philodendrons and anything that hates soggy roots. 5 litre bag.',
  }),
];
