# Fonts

All faces here are under the SIL Open Font License 1.1 (fonts/licenses/<family>-OFL.txt). The four Google faces are self-hosted,
subset and axis-narrowed copies of the same versions Google Fonts serves (css/fonts.css says how they are declared);
the Velvetyne faces (Basteleur, Compagnon, Gulax, Happy Times, Ouroboros) are the alternative type sets of js/type.js.

| family | source | version | files |
|---|---|---|---|
| Archivo | github.com/google/fonts ofl/archivo (Omnibus-Type) | 2.001 | archivo-core / -ext (wght 800-900, wdth 100-125) |
| Newsreader | github.com/google/fonts ofl/newsreader (Production Type) | 1.003 | newsreader-core / -ext, newsreader-italic-core / -ext (wght 400-700, opsz 6-72) |
| Instrument Serif | github.com/google/fonts ofl/instrumentserif (Rodrigo Fuenzalida, Jordan Egstad) | 1.000 | instrumentserif-core / -ext, instrumentserif-italic-core / -ext |
| JetBrains Mono | github.com/google/fonts ofl/jetbrainsmono (JetBrains) | 2.211 | jetbrainsmono-core / -ext (wght 400-700) |

The serif faces (Newsreader, Instrument Serif) also carry ḗ ṓ ḕ ṑ as composites of their own ē/ō and é/è parts, built by tools/build_fonts.py: none of these faces has them, and Newsreader shaped e + macron + acute with the acute beside the macron.

The file names carry a hash of their content (fonts/* is cached for a year, immutable). To rebuild after the site's
characters change: fetch the source TTFs from google/fonts into a folder and run `tools/build_fonts.py <that folder>
fonts` from the site root with fontTools and brotli installed; it writes the new files and css/fonts.css. Then delete
the old files and update the preloads in the page heads (grep `as="font"`).
