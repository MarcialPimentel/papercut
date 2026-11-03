# Putting Papercut on Steam: the store page

_Written 2026-11-02 for issue #41. Steam's rules change now and then; where this guide and Steamworks disagree, Steamworks wins (and tell Claude, so this guide gets fixed)._

Everything to upload is in [`art/store/`](../art/store/); the words are in [`art/store/store-copy.md`](../art/store/store-copy.md). This guide covers the account, the fee, the store page and "Coming soon". The game build itself (the desktop app, #30) and Steamworks features (#31) come later.

## The clock: start it today

| Step | How long | Why it matters |
|---|---|---|
| Sign up, pay the $100 fee | 30 minutes | **Starts the 30-day wait.** New developers can't release a game until 30 days after paying its fee |
| Tax, bank and identity checks | 15 to 30 days | Steam can't pay you, and some steps stay locked, until they're done |
| Store page review | 3 to 7 working days | Valve checks the page before it can go public |
| "Coming soon" page live | at least 2 weeks | Required before release |

If you pay on **2 November**, the earliest release is about **2 December**, and only if the "Coming soon" page is public by **18 November**. So aim to submit the page for review by **7 November**.

The fee: **$100 per game**, non-refundable. Valve gives it back in your payouts once the game has earned $1,000.

> Valve's own pages disagree on the wait (the Steam Direct page says 30 days, an older onboarding page says 21). Plan on 30.

## Part 1: Join Steamworks and pay the fee

You need: your Steam account, your legal name and address, a payment card, your bank details, and your tax number (in the US a Social Security Number; elsewhere your country's tax ID).

1. In a browser, go to **https://partner.steamgames.com** and sign in with your Steam account. Turn on Steam Guard (the mobile authenticator) first if Steamworks asks for it.
2. Click **Join Steamworks** (or **Sign up**, depending on the page).
3. Sign the **Non Disclosure Agreement** and the **Steam Distribution Agreement** (click through, type your name).
4. **Company information:** if you're publishing as yourself, pick **Sole Proprietorship** (or "Individual") and type your **legal first and last name**. Not "Marz", not a studio name: it must match your bank account and tax ID exactly, or payouts fail.
5. **Pay the Steam Direct fee:** $100 for one game ("app credit"). Pay with a card, not Steam Wallet funds.
6. **Tax interview:** Steamworks asks questions and fills in the right form for you (US citizens: like a W-9; outside the US: like a W-8BEN, which can lower US tax withheld if your country has a treaty). Answer as an individual.
7. **Bank information:** routing (or SWIFT/IBAN) and account number. The account holder name must be the same legal name as step 4.
8. **Identity verification:** follow the prompts (a photo of your ID, sometimes a selfie).
9. You'll see a dashboard with your checks pending. That's normal; carry on with Part 2 while they finish.

## Part 2: Create the app

1. On the Steamworks home page, click **Create new app** (it uses the app credit you just bought).
2. Name it **Papercut**. Steamworks gives it an **App ID** (a number). Send the App ID to Claude: the desktop build (#30) and Steamworks features (#31) need it.
3. Click into the app. You land on its **landing page**, with a **checklist** on the right. That checklist is the to-do list for the store page and, later, the release.

## Part 3: Fill in the store page

From the app's landing page, click **Edit Store Page**. Work through each tab; the items marked with a star (*) are required. Click **Save** at the bottom of each tab. A red bar at the top means you have unsaved or unpublished changes; that's fine until Part 4.

### Basic Info tab
1. **Short description:** paste the short description from `art/store/store-copy.md`.
2. **Genre:** Action and Indie. Leave the others unticked.
3. **Developer / Publisher:** your legal name, or the name you want shown (this one *can* be a studio name, it's display only).
4. **Supported languages:** English (interface and subtitles). No full audio. Only tick languages the game actually supports.
5. **Website:** `https://papercut.marz.gg`. (Steam doesn't allow links inside the descriptions, so this is the place.)
6. **Controller support:** leave it as **no controller support** until #32 ships. **Steam Deck:** leave it untested.
7. **Release date:** pick **Coming soon** and set the display text to **"Coming soon"** (or "December 2026" once you're sure). Don't promise a date you might miss.

### Description tab
1. **About This Game:** paste the long description from `art/store/store-copy.md`, tags and all (`[h2]`, `[b]`, `[list]` are Steam's formatting).
2. **Mature content:** answer the **Content Survey** honestly. The game has stylised sword violence: paper fighters get cut and split in two, with red paper (not blood or gore). Tick "Some violence or gore" with that description, and nothing else.
3. **AI-generated content disclosure** (in the Content Survey): the game's code, the store text and the store art layout were made with an AI assistant (Claude). Steam asks about AI-generated content that ships with the game or is on the store page. My recommendation: **disclose it**, in one plain line, for example "Code, store text and promotional layouts were made with AI assistance; the fighters were modelled by the developer in Blender." It's your call, but Valve can remove pages that hide it.
4. **Legal / EULA:** skip (Steam's default subscriber agreement applies).
5. **System requirements:** fill in after #30 (the desktop app), when we know what it needs. For now: Windows 10, 4 GB RAM, integrated graphics, 500 MB disk.

### Tags (Tag Wizard)
1. On the landing page, find **Tags** (or the **Tag Wizard** link in the checklist).
2. Add the 20 tags from `art/store/store-copy.md` **in that order**. Drag to reorder if needed: the first 5 describe the game everywhere on Steam.
3. If a tag isn't offered, pick the closest one the wizard suggests.

### Graphical Assets: store
Go to **Graphical Assets → Store Assets**. Drag each file onto its box; Steamworks checks the size and complains if it's wrong.

| Box | File in `art/store/` |
|---|---|
| Header Capsule (920 x 430) | `capsules/header_capsule_920x430.png` |
| Small Capsule (462 x 174) | `capsules/small_capsule_462x174.png` |
| Main Capsule (1232 x 706) | `capsules/main_capsule_1232x706.png` |
| Vertical Capsule (748 x 896) | `capsules/vertical_capsule_748x896.png` |
| Page Background (1438 x 810, optional) | `page_background_1438x810.png` |

### Graphical Assets: library
Same page, **Library Assets** section (or tab).

| Box | File |
|---|---|
| Library Capsule (600 x 900) | `library/library_capsule_600x900.png` |
| Library Header (920 x 430) | `library/library_header_920x430.png` |
| Library Hero (3840 x 1240) | `library/library_hero_3840x1240.jpg` |
| Library Logo (1280 wide, transparent) | `library/library_logo_1280x387.png` |

After uploading the logo, Steamworks shows a **preview** of the hero with the logo on it: pick **bottom left** for the logo position.

### Community icon
Under **Community Assets** (or **App Admin → Community**), upload `logo/community_icon_184x184.png` as the **Community Icon**. (The Windows app icon comes with the desktop build, #30.)

### Screenshots
1. **Graphical Assets → Screenshots.** Drag in all eight from `art/store/screenshots/` (1920 x 1080, from the real game).
2. Drag them into this order: 04, 01, 06, 02, 05, 03, 07, 08 (the counter cut first: it's the hook).
3. Tick **"Suitable for all ages"** on 02, 03, 05, 07 and 08 (Steam needs at least four). Leave the three with cuts (01, 04, 06) unticked.

### Trailer
1. On the landing page, open **Trailers** (or **Graphical Assets → Trailers**). Click **Upload new trailer**.
2. Pick `art/store/trailer/papercut_trailer_1080p30.mp4`.
3. Name it "Papercut gameplay trailer". **Category: Gameplay.**
4. Wait for **"Converting"** to finish (minutes to an hour), then drag it to the **first** position and tick it as shown on the store page.
5. Leave the poster as Steam's automatic one (no text allowed on it).

## Part 4: Check, submit for review, then go public

1. Click **Preview changes in store** (top right) and look over the page: capsule, screenshots, trailer, text. Check it in the small preview too: the logo must stay readable.
2. Open the **Publish** tab and click **Prepare for Publishing**, then **Publish**. This only uploads the page to Steam's servers; it stays hidden until it's approved and you make it visible.
3. Back on the landing page, the **Store Presence** part of the checklist should be all green. Click **Mark as ready for review** (Valve asks for this at least 7 working days before you want the page public).
4. Wait for the email from Valve (usually 3 to 5 working days). If they ask for changes, tell Claude what they said; most fixes are one re-render.
5. Once approved, a **"Release your Coming Soon page"** (or similar) button appears on the landing page. Click it. The page is now public, people can wishlist it, and **the 2-week clock starts**.

## Refreshing the art later

Everything in `art/store/` is rendered from the real game by code, so when the fighters change (#37) or the fight is tuned, Claude re-runs:

```bash
npm run store:art
```

```bash
npm run store:shots
```

```bash
npm run store:trailer
```

Then upload the new files over the old ones in Steamworks (same boxes) and publish again. After release, store page changes go live as soon as you publish.

The tools need a headless Chromium. If `npm run store:art` says it can't find one, run `npx playwright-core install chromium` once.
