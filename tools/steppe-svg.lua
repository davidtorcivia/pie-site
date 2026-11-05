-- steppe-svg.lua: florilegium-svg.lua with a steppe flora. The document's pool of eight species is replaced by
-- genomes of plants of the Pontic–Caspian steppe, each a florilegium body plan with the traits that make it that
-- plant fixed and the rest sampled from the seed. Pollination syndromes are kept to the steppe's own visitors
-- (bees, butterflies, beetles, flies, wind): no hummingbirds.
--   cd vendor/florilegium && lua ../../tools/steppe-svg.lua --seed 7 [florilegium-svg options] -o leaf.svg
package.path = "./?.lua;" .. package.path
-- PIE_NOFOOTER: no footer stem running along the foot (it reads as a long, repetitive horizontal); the grower is
-- loaded from its own source with that one switch changed
if os.getenv("PIE_NOFOOTER") then
  local f = assert(io.open("florilegium-grow.lua")); local src = f:read("a"); f:close()
  local n; src, n = src:gsub("local FOOTER = D >= 0%.2", "local FOOTER = false")
  assert(n == 1, "steppe-svg: the footer switch moved")
  package.preload["florilegium-grow"] = function(...) return assert(load(src, "@florilegium-grow.lua"))(...) end
end
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

-- obstacles (PIE_OBSTACLES="x0,y0,x1,y1;..." in page cm, y up from the foot): the garden grows around them, never
-- under them. The region the garden may use becomes the page cut into a grid at the obstacles' edges, every cell not
-- inside an obstacle kept; shared edges are open, so the free discs flow round the obstacles.
local OBS = {}
for q in (os.getenv("PIE_OBSTACLES") or ""):gmatch("[^;]+") do
  local a, b, c, d = q:match("([%d.-]+),([%d.-]+),([%d.-]+),([%d.-]+)")
  if a then OBS[#OBS + 1] = { tonumber(a), tonumber(b), tonumber(c), tonumber(d) } end
end
if #OBS > 0 then
  local GROW = require("florilegium-grow")
  local orig = GROW.regions
  GROW.regions = function(g, layout)
    local rects, col, foot, spill, fx1 = orig(g, layout)
    local X0, Y0, X1, Y1 = 0.3, 0.4, g.pw - 0.3, g.ph - 0.5
    local xs, ys = { X0, X1 }, { Y0, Y1 }
    for _, o in ipairs(OBS) do xs[#xs + 1] = math.max(X0, math.min(X1, o[1])); xs[#xs + 1] = math.max(X0, math.min(X1, o[3]))
      ys[#ys + 1] = math.max(Y0, math.min(Y1, o[2])); ys[#ys + 1] = math.max(Y0, math.min(Y1, o[4])) end
    table.sort(xs); table.sort(ys)
    local out = { corners = true }
    for i = 1, #xs - 1 do for j = 1, #ys - 1 do
      local a, b, c, d = xs[i], ys[j], xs[i + 1], ys[j + 1]
      if c - a > 0.05 and d - b > 0.05 then
        local mx, my, blocked = (a + c) / 2, (b + d) / 2, false
        for _, o in ipairs(OBS) do if mx > o[1] and mx < o[3] and my > o[2] and my < o[4] then blocked = true end end
        if not blocked then out[#out + 1] = { a, b, c, d } end
      end
    end end
    return out, col, foot, spill, fx1
  end
end
local SVG = dofile("florilegium-svg.lua")          -- returns its module when not run as the main script
os.exit(SVG.main(arg))
