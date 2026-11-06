-- steppe-svg.lua: florilegium-svg.lua with a steppe flora. The document's pool of eight species is replaced by
-- genomes of plants of the Pontic–Caspian steppe, each a florilegium body plan with the traits that make it that
-- plant fixed and the rest sampled from the seed. Pollination syndromes are kept to the steppe's own visitors
-- (bees, butterflies, beetles, flies, wind): no hummingbirds.
--   cd vendor/florilegium && lua ../../tools/steppe-svg.lua --seed 7 [florilegium-svg options] -o leaf.svg
package.path = "./?.lua;" .. package.path
local OBS = {}
for q in (os.getenv("PIE_OBSTACLES") or ""):gmatch("[^;]+") do
  local a, b, c, d = q:match("([%d.-]+),([%d.-]+),([%d.-]+),([%d.-]+)")
  if a then OBS[#OBS + 1] = { tonumber(a), tonumber(b), tonumber(c), tonumber(d) } end
end
-- repulsors: text and other objects push the garden away. A main stem is pushed sideways round an obstacle (easing in
-- and out, so it curves); a branch only grows from a stem point with a clear line to its flower.
local M_STEM, M_LINE = 0.7, 0.35
local function seg_hits(x1, y1, x2, y2, o, m)
  local t0, t1, dx, dy = 0, 1, x2 - x1, y2 - y1
  for _, e in ipairs({ { -dx, x1 - (o[1] - m) }, { dx, (o[3] + m) - x1 }, { -dy, y1 - (o[2] - m) }, { dy, (o[4] + m) - y1 } }) do
    local pp, q = e[1], e[2]
    if pp == 0 then if q < 0 then return false end
    else local r = q / pp; if pp < 0 then if r > t1 then return false elseif r > t0 then t0 = r end else if r < t0 then return false elseif r < t1 then t1 = r end end end
  end
  return true
end
function PIE_BLOCKED(x1, y1, x2, y2) for _, o in ipairs(OBS) do if seg_hits(x1, y1, x2, y2, o, M_LINE) then return true end end return false end
function PIE_PUSH(x, y)
  for _, o in ipairs(OBS) do
    local m = M_STEM
    local dy = (y < o[2] - m) and (o[2] - m - y) or (y > o[4] + m) and (y - o[4] - m) or 0
    local w = 1 - math.min(1, dy / 2.0); w = w * w * (3 - 2 * w)                    -- full inside its height, easing off over 2 cm
    if w > 0 and x > o[1] - m - 1.5 and x < o[3] + m + 1.5 then
      local left, right = o[1] - m, o[3] + m
      local tgt = (x - left < right - x) and math.min(x, left) or math.max(x, right)
      if math.abs(tgt - x) > 2.5 then return nil end            -- too far round: the stem ends here
      x = x + (tgt - x) * w
    end
  end
  return x
end
function PIE_INSIDE(x, y) for _, o in ipairs(OBS) do if x > o[1] - .2 and x < o[3] + .2 and y > o[2] - .2 and y < o[4] + .2 then return true end end return false end
-- the grower is loaded from its own source with two switches changed:
--   PIE_NOFOOTER  no footer stem running along the foot (it reads as a long, repetitive horizontal)
--   always        no safety clip round the regions: a plant ends where it grows to, it is never cut off
do
  local f = assert(io.open("florilegium-grow.lua")); local src = f:read("a"); f:close()
  local n
  if os.getenv("PIE_NOFOOTER") then
    src, n = src:gsub("local FOOTER = D >= 0%.2", "local FOOTER = false"); assert(n == 1, "steppe-svg: the footer switch moved")
  end
  src, n = src:gsub("ink%.poly%(%{ %{ x1, y1 %}, %{ x2, y1 %}, %{ x2, y2 %}, %{ x1, y2 %} %}, true%)",
    "ink.poly({ { -80, -80 }, { 400, -80 }, { 400, 400 }, { -80, 400 } }, true)")
  assert(n == 1, "steppe-svg: the safety clip moved")
  if #OBS > 0 then
    -- main stems: pushed round obstacles; a stem that cannot pass ends below it
    src, n = src:gsub("      x = max%(0%.9, min%(g%.colright %- 0%.9, x%)%)\n      pts%[#pts %+ 1%] = %{ x, y %}",
      "      x = max(0.9, min(g.colright - 0.9, x))\n      if PIE_INSIDE(x, y) then break end\n      pts[#pts + 1] = { x, y }")
    assert(n == 1, "steppe-svg: the main stem loop moved")
    -- the nearest stem point with a clear line, if there is one
    src, n = src:gsub("        local d = dist%(x, y, p%[1%], p%[2%]%)\n        if d < best then best, bp = d, p end",
      "        local d = dist(x, y, p[1], p[2])\n        if PIE_BLOCKED(x, y, p[1], p[2]) then d = d + 1000 end\n        if d < best then best, bp = d, p end")
    assert(n == 1, "steppe-svg: nearest_stem moved")
    -- the branch loop skips holes no stem reaches cleanly
    src, n = src:gsub("    local _, bi = layout%.best%(free, #gx, 0%.85, 1%.15, sdist, REACH%)\n",
      "    local _, bi = layout.best(free, #gx, 0.85, 1.15, sdist, REACH)\n    for __k = 1, 60 do\n      if not bi then break end\n      local S0, dd = nearest_stem(gx[bi], gy[bi])\n      if not S0 or dd < 1000 then break end\n      free[bi] = 0\n      local __u; __u, bi = layout.best(free, #gx, 0.85, 1.15, sdist, REACH)\n    end\n", 1)
    assert(n == 1, "steppe-svg: the branch loop moved")
  end
  -- PIE_STEMX: where across the page the main stems root and sway (a fraction of the width; default the grower's own)
  if os.getenv("PIE_STEMX") then
    src, n = src:gsub("local root = %{ layout%.range%(1%.0, 1%.6%), 0%.75 %}",
      "local root = { g.colright * tonumber(os.getenv('PIE_STEMX')) - 1.3 + layout.range(1.0, 1.6), 0.75 }")
    assert(n == 1, "steppe-svg: the stem root moved")
    src, n = src:gsub("local midx = g%.colright %* 0%.47", "local midx = g.colright * tonumber(os.getenv('PIE_STEMX'))")
    assert(n == 1, "steppe-svg: the stem sway moved")
    src, n = src:gsub("local amp = g%.colright %* 0%.2\n", "local amp = g.colright * 0.08\n")
  end
  package.preload["florilegium-grow"] = function(...) return assert(load(src, "@florilegium-grow.lua"))(...) end
end
local SPC = require("florilegium-species")
local ink = require("florilegium-ink")

-- the steppe flora, by the role each can play on a page; every garden draws its own eight (two heroes, two sprays,
-- a monocot, three others) from these, so neighbouring gardens differ
local F = {
  hero = {
    { plan = "lily", syndrome = "bee", color = "yellow", form = "lily", cup = 0.85, reflex = 0, petalshape = "obovate", inflo = "solitary", orient = "erect", leafshape = "lanceolate", venation = "parallel", guides = "blotch", fruit = "capsule" },   -- steppe tulip
    { plan = "rose", syndrome = "beetle", color = "pink", inflo = "solitary", compound = "bipinnate", leafshape = "linear", dissection = 0.9, stamens = "exserted", fruit = "follicle" },   -- fern-leaf peony
    { plan = "daisy", syndrome = "bee", color = "yellow", inflo = "solitary", rays = 16, compound = "bipinnate", leafshape = "linear", dissection = 0.85, fruit = "achene" },   -- Adonis vernalis
    { plan = "eudicot", syndrome = "bee", color = "violet", form = "rosaceous", merosity = 6, petalshape = "oblong", cup = 0.6, inflo = "solitary", hairy = 1, fruit = "pappus" },   -- pasque flower
    { plan = "rose", syndrome = "bee", color = "blue", inflo = "corymb", merosity = 5, compound = "simple", leafshape = "linear", fruit = "capsule" },   -- steppe flax
  },
  spray = {
    { plan = "daisy", syndrome = "wind", color = "yellow", rays = 0, inflo = "panicle", size = 4, compound = "bipinnate", leafshape = "linear", dissection = 0.85, hairy = 1, fruit = "achene" },   -- wormwood
    { plan = "mint", syndrome = "bee", color = "violet", inflo = "spike", orient = "nodding", leafshape = "ovate", leafmargin = "crenate", arrangement = "opposite", fruit = "nutlets" },   -- nodding sage
    { plan = "mint", syndrome = "bee", color = "blue", inflo = "spike", orient = "erect", leafshape = "lanceolate", arrangement = "opposite", fruit = "nutlets" },   -- spiked speedwell
    { plan = "mustard", syndrome = "fly", color = "white", inflo = "panicle", fruit = "silicle" },   -- Crambe, sea-kale of the steppe
    { plan = "mint", syndrome = "bee", color = "yellow", inflo = "thyrse", leafshape = "ovate", hairy = 1, fruit = "nutlets" },   -- Phlomis
    { plan = "umbellifer", syndrome = "fly", color = "white", fruit = "schizocarp" },   -- steppe fennel
  },
  monocot = {
    { plan = "iris", syndrome = "bee", color = "violet", inflo = "solitary", leafshape = "linear", venation = "parallel" },   -- dwarf iris
    { plan = "lily", syndrome = "bee", color = "violet", inflo = "umbel", leafshape = "linear", venation = "parallel", fruit = "capsule" },   -- steppe onion
    { plan = "monocot", syndrome = "wind", color = "green", inflo = "spike", leafshape = "linear", venation = "parallel" },   -- feather grass
  },
  any = {
    { plan = "pea", syndrome = "bee", color = "yellow", inflo = "raceme", compound = "pinnate", leaflets = 9, leafshape = "elliptic", fruit = "legume" },   -- milk-vetch
    { plan = "lily", syndrome = "butterfly", color = "red", form = "lily", cup = 0.7, reflex = -10, inflo = "solitary", leafshape = "lanceolate", venation = "parallel", fruit = "capsule" },   -- red tulip
    { plan = "daisy", syndrome = "bee", color = "blue", rays = 0, inflo = "solitary", leafmargin = "pinnatifid", section = "prickly", fruit = "achene" },   -- globe thistle
    { plan = "daisy", syndrome = "butterfly", color = "pink", rays = 12, inflo = "corymb", leafmargin = "pinnatifid", fruit = "pappus" },   -- knapweed
    { plan = "rose", syndrome = "butterfly", color = "pink", merosity = 5, petalmargin = "fimbriate", inflo = "dichasium", leafshape = "linear", arrangement = "opposite", fruit = "capsule" },   -- steppe pink
    { plan = "pea", syndrome = "bee", color = "violet", inflo = "raceme", compound = "pinnate", leaflets = 7, tendrils = 1, habit = "climbing", fruit = "legume" },   -- tufted vetch
  },
}
local SLOTS = { "hero", "hero", "spray", "spray", "monocot", "any", "any", "any" }
local pools = {}
SPC.pool = function(docseed)
  docseed = docseed or 0
  if pools[docseed] then return pools[docseed] end
  local rng = ink.rng(docseed * 104729 + 307)
  local pool, used = {}, {}
  for i, role in ipairs(SLOTS) do
    local list, fix = F[role]
    repeat fix = list[1 + math.floor(rng.u() * #list)] until not used[fix] or #list < 3
    used[fix] = true
    local sp = SPC.sample(1 + math.floor(rng.u() * 2147483645), role, nil, fix)
    sp.slot = i
    pool[i] = sp
  end
  pools[docseed] = pool
  return pool
end

-- obstacles (PIE_OBSTACLES="x0,y0,x1,y1;..." in page cm, y up from the foot): the garden grows around them, never
-- under them. The region the garden may use becomes the page cut into a grid at the obstacles' edges, every cell not
-- inside an obstacle kept; shared edges are open, so the free discs flow round the obstacles.
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
-- PIE_FRAME="k/n": draw frame k of n of the garden's growth (florilegium's own animation: stems rise, leaves open,
-- flowers bloom in the order they grew), for the page's grow-in
do
  local k, n = (os.getenv("PIE_FRAME") or ""):match("^(%d+)/(%d+)$")
  if k then
    local req = require
    require = function(name)                -- florilegium needs the stubs florilegium-svg.lua sets first
      local m = req(name)
      if name == "florilegium" and type(m) == "table" and m.frame then m.frame(tonumber(k), tonumber(n)) end
      return m
    end
  end
end
local SVG = dofile("florilegium-svg.lua")          -- returns its module when not run as the main script
os.exit(SVG.main(arg))
