# TazaTokri Vegetable Photography & Asset Guide

This guide explains how to shoot (or source), resize, name, document, and verify real photographs for the 36 vegetables in TazaTokri without external build dependencies or unlicensed images.

---

## 1. Shooting Your Own Photos (Recommended)

Shooting your own stall produce guarantees accurate local varieties and zero third-party copyright risk.

1. **Surface:** Place the vegetable on a plain, clean, matte cream or neutral light surface (off-white paper, unbleached cotton cloth, or a clean pale board). Avoid busy table patterns or plastic bags.
2. **Lighting:** Shoot beside a bright window with soft natural daylight. **Turn flash OFF** — harsh direct flash creates wet-looking glare on brinjal, capsicum, and tomatoes.
3. **Framing:** Hold the phone/camera overhead (`45°` to top-down `90°`), set to `1:1` square mode if available, and frame **one vegetable variety per photo** filling roughly **70–80% of the square frame** with breathing room around all edges and zero text, watermarks, logos, or collages.
4. **Preparation:** Brush off loose dirt or water droplets gently, keep stalks/calyx natural (e.g. tomato calyx, brinjal crown, tied methi/palak bunch), and avoid stickers, price tags, or rubber bands facing the camera.

---

## 2. Crop & Optimize with Squoosh (`600x600`, `<= 80 KB`)

Because no image-processing dependency is bundled in `package.json`, optimize each photo cleanly in the browser:

1. Open **[squoosh.app](https://squoosh.app/)**.
2. Drop your photo in.
3. Enable **Resize**:
   - Crop/choose square **`1:1`** first (or crop square on your phone beforehand, center-cropped on the vegetable).
   - Set **Width:** `600`, **Height:** `600`.
4. Under **Compress**, select **MozJPEG** and set **Quality:** `80`.
5. Check the output preview size badge at bottom-right — aim for **under 80 KB** (`50-75 KB` is typical at `600x600` quality `80`; lower quality slightly to `75` if a textured bunch like coriander exceeds `80 KB`).
6. Download and save as `public/vegetables/<slug>.jpg` (lowercase `.jpg`).

---

## 3. Exact Filenames (`public/vegetables/<slug>.jpg`)

Use the exact lowercase slug below — mismatches will fall back to illustrations:

- `public/vegetables/amaranth.jpg` — Amaranth (Math)
- `public/vegetables/beetroot.jpg` — Beetroot
- `public/vegetables/bitter-gourd.jpg` — Bitter Gourd (Karela)
- `public/vegetables/bottle-gourd.jpg` — Bottle Gourd (Dudhi)
- `public/vegetables/brinjal.jpg` — Brinjal (Vangi)
- `public/vegetables/cabbage.jpg` — Cabbage
- `public/vegetables/capsicum.jpg` — Capsicum
- `public/vegetables/carrot.jpg` — Carrot (Gajar)
- `public/vegetables/cauliflower.jpg` — Cauliflower
- `public/vegetables/cluster-beans.jpg` — Cluster Beans (Gawar)
- `public/vegetables/cucumber.jpg` — Cucumber
- `public/vegetables/curry-leaves.jpg` — Curry Leaves
- `public/vegetables/dill-leaves.jpg` — Dill Leaves (Shepu)
- `public/vegetables/drumstick.jpg` — Drumstick (Shevga)
- `public/vegetables/fenugreek.jpg` — Fenugreek (Methi)
- `public/vegetables/french-beans.jpg` — French Beans
- `public/vegetables/fresh-coriander.jpg` — Fresh Coriander
- `public/vegetables/garlic.jpg` — Garlic (Lasun)
- `public/vegetables/ginger.jpg` — Ginger (Ale)
- `public/vegetables/green-chilli.jpg` — Green Chilli (Mirchi)
- `public/vegetables/green-peas.jpg` — Green Peas (Matar)
- `public/vegetables/lemon.jpg` — Lemon (Limbu)
- `public/vegetables/mint.jpg` — Mint (Pudina)
- `public/vegetables/okra.jpg` — Okra (Bhendi)
- `public/vegetables/onion.jpg` — Onion (Kanda)
- `public/vegetables/potato.jpg` — Potato (Batata)
- `public/vegetables/pumpkin.jpg` — Pumpkin (Bhopla)
- `public/vegetables/radish.jpg` — Radish (Mula)
- `public/vegetables/raw-banana.jpg` — Raw Banana (Kaccha Kela)
- `public/vegetables/ridge-gourd.jpg` — Ridge Gourd (Dodka)
- `public/vegetables/spinach.jpg` — Spinach (Palak)
- `public/vegetables/spring-onion.jpg` — Spring Onion
- `public/vegetables/sweet-corn.jpg` — Sweet Corn
- `public/vegetables/sweet-potato.jpg` — Sweet Potato (Ratale)
- `public/vegetables/tomato.jpg` — Tomato
- `public/vegetables/yam.jpg` — Yam (Suran)

---

## 4. Document Source & Verify Before Committing

Every photo in `public/vegetables/` MUST be logged in [`docs/IMAGES.md`](./IMAGES.md) before shipping:

1. Update that vegetable's row in `docs/IMAGES.md`:
   - `Status` -> `photo`
   - `Source` -> `own` (or `Pexels` / `Unsplash` / `Pixabay`)
   - `Author` -> Photographer / store owner name
   - `Source URL` -> `own-shoot` (or exact licensed photo page URL)
   - `Licence` -> e.g. `Own work (TazaTokri)` or `Pexels License`
   - `Date Added` -> `YYYY-MM-DD`
   - `Reviewed by Owner` -> `yes` after checking in `/staff/catalog/images`
2. Run:
   ```bash
   npm run check:images
   ```
   This script verifies square JPEG dimensions, warns if any image exceeds `80 KB`, and **fails (`exit 1`)** if any image lacks both `Source` and `Licence` in `docs/IMAGES.md`.
