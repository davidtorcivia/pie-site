-- steppe-svg.lua: florilegium-svg.lua with a steppe flora. The document's pool of eight species is replaced by
-- genomes of plants of the Pontic–Caspian steppe, each a florilegium body plan with the traits that make it that
-- plant fixed and the rest sampled from the seed. Pollination syndromes are kept to the steppe's own visitors
-- (bees, butterflies, beetles, flies, wind): no hummingbirds.
--   cd vendor/florilegium && lua ../../tools/steppe-svg.lua --seed 7 [florilegium-svg options] -o leaf.svg
package.path = "./?.lua;" .. package.path
local SPC = require("florilegium-species")
local ink = require("florilegium-ink")

local STEPPE = {
  -- slot 1, hero: steppe tulip (Tulipa suaveolens / T. schrenkii), a yellow cup alone on its stalk
  { role = "hero", fix = { plan = "lily", syndrome = "bee", color = "yellow", form = "lily", cup = 0.85, reflex = 0,
      petalshape = "obovate", apex = "acute", inflo = "solitary", orient = "erect", leafshape = "lanceolate",
      venation = "parallel", arrangement = "alternate", guides = "blotch", fruit = "capsule" } },
  -- slot 2, hero: fern-leaf peony (Paeonia tenuifolia), one flower over thread-fine leaves
  { role = "hero", fix = { plan = "rose", syndrome = "beetle", color = "pink", inflo = "solitary", compound = "bipinnate",
      leafshape = "linear", leafmargin = "entire", dissection = 0.9, stamens = "exserted", fruit = "follicle" } },
  -- slot 3, spray: wormwood (Artemisia), tiny heads in loose panicles, finely cut grey leaves, wind-pollinated
  { role = "spray", fix = { plan = "daisy", syndrome = "wind", color = "yellow", rays = 0, inflo = "panicle", size = 4,
      compound = "bipinnate", leafshape = "linear", dissection = 0.85, hairy = 1, fruit = "achene" } },
  -- slot 4, spray: nodding sage (Salvia nutans), violet two-lipped flowers on a drooping spike
  { role = "spray", fix = { plan = "mint", syndrome = "bee", color = "violet", inflo = "spike", orient = "nodding",
      leafshape = "ovate", leafmargin = "crenate", arrangement = "opposite", section = "square", fruit = "nutlets" } },
  -- slot 5, monocot: dwarf iris (Iris pumila)
  { role = "monocot", fix = { plan = "iris", syndrome = "bee", color = "violet", inflo = "solitary", leafshape = "linear",
      venation = "parallel" } },
  -- slots 6–8: pasque flower (Pulsatilla), milk-vetch (Astragalus), and a second tulip of another colour
  { role = "any", fix = { plan = "eudicot", syndrome = "bee", color = "violet", form = "rosaceous", merosity = 6,
      petalshape = "oblong", cup = 0.6, inflo = "solitary", compound = "bipinnate", leafshape = "linear", hairy = 1, fruit = "pappus" } },
  { role = "any", fix = { plan = "pea", syndrome = "bee", color = "yellow", inflo = "raceme", compound = "pinnate",
      leaflets = 9, leafshape = "elliptic", fruit = "legume" } },
  { role = "any", fix = { plan = "lily", syndrome = "butterfly", color = "red", form = "lily", cup = 0.7, reflex = -10,
      inflo = "solitary", orient = "erect", leafshape = "lanceolate", venation = "parallel", fruit = "capsule" } },
}

local pools = {}
SPC.pool = function(docseed)
  docseed = docseed or 0
  if pools[docseed] then return pools[docseed] end
  local rng = ink.rng(docseed * 104729 + 307)
  local pool = {}
  for i, s in ipairs(STEPPE) do
    local sp = SPC.sample(1 + math.floor(rng.u() * 2147483645), s.role, nil, s.fix)
    sp.slot = i
    pool[i] = sp
  end
  pools[docseed] = pool
  return pool
end

local SVG = dofile("florilegium-svg.lua")          -- returns its module when not run as the main script
os.exit(SVG.main(arg))
