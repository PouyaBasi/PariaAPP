# Paria – Admin manual (your side)

Your admin page: `https://YOURNAME.github.io/paria/admin.html`
Open it **always in the same browser** where you created your signing key.

## The monthly routine (2 minutes)

1. **Paria creates her account** and sees "Pay Pouya to get credit for 1 month…". She taps the price and card number (they are copied automatically), pays, and sends the receipt to your Telegram. The button "Copy my request message" gives her a text that contains her **username**.
2. **You check the payment** in your bank app.
3. Open **admin.html** → in *Approve a payment* type her **username** (exactly as in her message) → choose **1 month** → tap **Approve & make code**.
4. Tap **Send on Telegram** (or **Copy message** and paste it to her). The message contains the activation code and the date until which she has access.
5. **She pastes the code** in the app (payment screen → code box → **Unlock for 1 month**). The app opens.
6. After the paid period the app locks itself and shows the payment screen again. Repeat from step 1.

Good to know:
- If she pays **before** the month ends, the new code **extends from the old end date** automatically. She doesn't lose days.
- You can give 2, 3, 6 or 12 months at once with the drop-down.
- **Codes I made** (bottom of admin.html) lists every code with its end date. You can copy a code again from there.
- The code only works for the username you typed. It can't be shared with another username.
- A month is 30 days. Change `DAYS_PER_MONTH` in config.js if you want another length.

## What she sees if something is wrong

| She sees | Meaning | What to do |
|---|---|---|
| "That code is for the username X, but you are Y" | Username mismatch | Ask her for her exact username (it is shown on her payment screen and in ⚙️), make a new code |
| "That code isn't valid" | The code was copied incompletely | Send it again, the whole text |
| "That code has already expired" | Old code | Make a new one |
| "This app isn't ready for codes yet" | PUBLIC_KEY is still `null` in config.js | Do Setup Part 2 |

## Common situations

- **She forgot her password:** on the login screen she taps *Forgot my password*, then creates a new account. If she uses the **same username**, her current code keeps working. With a different username you must make a new code.
- **New phone or she deleted the app:** she installs it again, creates an account with the **same username**, and pastes her last code again (as long as it hasn't expired).
- **You want to stop her access:** don't make the next code. The current code can't be cancelled early, because the app checks it on her phone. (Creating a new key in config.js would cancel every code at once.)
- **You lost your private key:** create a new key in admin.html, put the new public key in config.js. All old codes stop working, so make new codes for her.
- **Change price or card number:** edit `PRICE_TEXT`, `PRICE_COPY`, `CARD_TEXT`, `CARD_COPY` in config.js (on GitHub, ✏️, commit). `*_COPY` is what lands in the clipboard (digits only, so banking apps accept it).
- **Change the Telegram username or Shayan's number:** edit `TELEGRAM_USERNAME` / `SHAYAN_PHONE` in config.js.
- **Add more love notes:** add lines to the list in `messages.js`.

## Security notes
- The **private key** never leaves your browser. Don't send it to anyone. Keep one backup copy.
- The activation codes are digitally signed. Without your private key nobody can make a valid one.
- Her account (username/password) is stored only on her phone, so you can't see or reset her password. It works as an app lock plus the identity your codes are tied to.
- If she moves her phone clock backwards to cheat, the app keeps using the latest date it has seen.
- If you would like instant, one-tap approval from a server (no copying codes), that is possible with a small online database. Ask me and I'll build that version.
