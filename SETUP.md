# Paria for iPhone – Setup guide (step by step)

## What you are getting (and why it is not an .ipa file)

A real iPhone app file (.ipa) can only be built on a Mac with Xcode and an Apple Developer account (99 USD/year), and I can't do that for you from here. Instead this is a **web app that installs on the iPhone Home Screen** (a "PWA"). It looks and works like an app: own icon, full screen, no browser bars, works offline, and can send notifications on iOS 16.4 or newer.

The monthly payment lock works **without any server**:
- Paria creates an account on her phone (username + password).
- She pays and sends you the receipt on Telegram.
- On **admin.html** (your private page) you approve her username. It creates a **signed activation code** (valid for 30 days).
- She pastes the code in the app and it opens. After 30 days it locks again.
- Only your private key can create valid codes. She can't make her own.

You need: a free GitHub account, her iPhone (iOS 16.4+), your Telegram username, Shayan's phone number.

---

## Part 1 – Put the app online (about 10 minutes)

1. Go to **github.com**, sign in, click **+ → New repository**. Name it `paria`, choose **Public**, click **Create repository**.
   *(GitHub Pages is free only for public repositories. The card number and price in config.js will be visible to anyone who finds the repo. The private key is never stored there.)*
2. Unzip `Paria.zip` on your computer. On the repo page click **Add file → Upload files** and drag **the files inside the folder** (not the folder itself): `index.html`, `app.js`, `config.js`, `admin.html`, `sw.js`, the `icons` folder, etc. Click **Commit changes**.
   *If the hidden `.github` folder is skipped, that's fine for now. It is only needed for Part 4.*
3. In the repo go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, press **Save**.
4. Wait 1–2 minutes and refresh. GitHub shows your address: `https://YOURNAME.github.io/paria/`. Open it, you should see "Welcome to Paria". That is the link you will give her.
5. Edit **config.js** (click the file, then the pencil ✏️ icon):
   - `TELEGRAM_USERNAME:` your Telegram username, without the @
   - `SHAYAN_PHONE:` Shayan's number with country code, for example `"+989121234567"`
   - (price and card number are already filled in)
   Click **Commit changes**.

## Part 2 – Create your signing key (once, 3 minutes)

1. Open `https://YOURNAME.github.io/paria/admin.html` on the device you will normally use for approving payments.
2. Tap **Create my signing key**.
3. Tap **Copy public key line**. In GitHub open **config.js** → ✏️ → replace the line `PUBLIC_KEY: null,` with the copied line (it starts with `PUBLIC_KEY: {"kty":...`). Commit.
4. Wait a minute, reload admin.html. You should now see a green **✅ The app already has this key**.
5. **Back up the private key now:** tap **Backup private key**, then paste it into a safe note or password manager. If you ever clear Safari data, change browser or lose the phone without this backup, you can't approve payments any more.

> **Important:** the private key lives inside the browser you created it in. Always open admin.html in the *same* browser (for example always Safari, or always Chrome on your computer). A browser tab and a Home Screen icon on iPhone do not share data.

## Part 3 – Install on her iPhone

1. Send her the link (`https://YOURNAME.github.io/paria/`) on Telegram.
2. She must open it in **Safari** (not in Telegram's built-in browser, not in Chrome).
3. Tap **Share ⬆️ → Add to Home Screen → Add**.
4. She opens **Paria from the Home Screen icon** and creates her account there. *(Do this step after installing, because the Safari tab and the installed app keep separate data.)*
5. She sees the payment screen. Continue with the **Admin manual** to approve her.

## Part 4 – Daily good-morning notifications (optional, about 20 minutes)

Without this part the app still works. She sees the day's love note in ⚙️ Settings and can press "Send a test note". For a real push every morning you need a small free sender. I use OneSignal (free) plus a GitHub Action that runs every day. I couldn't test OneSignal's website from here, so if a menu is named a bit differently, follow the idea.

1. Create a free account at **onesignal.com** → **New App** → name `Paria` → platform **Web**. Choose the **Custom Code** setup. Site name `Paria`, Site URL `https://YOURNAME.github.io/paria/`. (If OneSignal refuses a URL with a path, create the repo as `YOURNAME.github.io` instead, so the app lives at `https://YOURNAME.github.io/`.)
2. Copy the **App ID** into `ONESIGNAL_APP_ID` in config.js and commit.
3. In OneSignal open **Settings → Keys & IDs** and copy the **REST API Key**.
4. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**. Add three secrets:
   - `ONESIGNAL_APP_ID` = the App ID
   - `ONESIGNAL_REST_API_KEY` = the REST API key
   - `SITE_URL` = `https://YOURNAME.github.io/paria/`
5. Make sure the files `.github/workflows/daily-push.yml` and `scripts/send_push.js` are in the repo. (Create them with **Add file → Create new file** and paste the content if the upload skipped them.)
6. On her phone: open Paria from the Home Screen → ⚙️ → **Turn on good-morning notifications** → Allow.
7. Test: GitHub → **Actions → Daily good-morning notification → Run workflow**. Her phone should buzz within a minute.
8. After that a new note goes out every day at **08:00 Iran time** (edit the `cron` line in the workflow to change it; it is written in UTC). GitHub can be a few minutes late, and it pauses scheduled jobs after 60 days with no activity in the repo. If that happens just press **Run workflow** once.

## Part 5 – A real App Store app (optional)
If you ever want a real native app: you need a Mac with Xcode and an Apple Developer account. This web app can be wrapped with Capacitor. Ask me and I'll prepare the steps.

## Updating the app later
Edit a file on GitHub (✏️), commit, wait a minute. She sees the update the next time she opens the app (close and reopen it once).
