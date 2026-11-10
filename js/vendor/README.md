# Vendored scripts

Byte-for-byte copies of the CDN builds the pages used before (same versions, so nothing in their behaviour changes),
served from this origin so that a page no longer opens a connection to cdnjs or jsdelivr before js/main.js can run.

| file | source | version | license |
|---|---|---|---|
| gsap.min.js | https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js (npm `gsap`) | 3.12.5 | GreenSock standard "no charge" license, header in the file; https://gsap.com/standard-license (use at no charge in commercial and non-commercial sites as long as end users are not charged to use them) |
| ScrollTrigger.min.js | https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js | 3.12.5 | as gsap.min.js |
| lenis.min.js | https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js (npm `lenis`) | 1.1.13 | MIT, darkroom.engineering: LICENSE-lenis.txt (the minified build carries no header) |

sha256 at vendoring (2026-11-09):
- gsap.min.js 28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087
- ScrollTrigger.min.js ad33c2df9ada8a663c2147357828f980d0b7ca731ef33eb3c6e4f327c3b2cda5
- lenis.min.js b2958f142f832f0d5e547cdef77e6fadfce16bea60982fc8bbf50395a2439df8

To update, replace a file with the new build from the same source and change the version here and in the pages that load it.
