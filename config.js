// ─────────────────────────────────────────────────────────────
//  Paria – settings you can edit (then commit the file on GitHub)
// ─────────────────────────────────────────────────────────────
window.PARIA_CONFIG = {
  // 1) Filled in AFTER you create your signing key in admin.html (see SETUP.md, step 4)
  PUBLIC_KEY: null,

  // 2) Payment screen
  PRICE_TEXT: "10.000.000 Rial",
  PRICE_COPY: "10000000",                 // what gets copied when she taps the price
  CARD_TEXT: "6362-1410-5006-6704",
  CARD_COPY: "6362141050066704",          // what gets copied when she taps the card number
  TELEGRAM_USERNAME: "@Pouya_basi",   // your Telegram @username, without the @

  // 3) "Text Shayan" button: Shayan's phone number with country code, e.g. "+989121234567"
  //    (if left empty the Messages app still opens, she just picks the contact)
  SHAYAN_PHONE: "+989133574436",

  // 4) Daily push notifications (optional, see SETUP.md part 2). Leave empty to skip.
  ONESIGNAL_APP_ID: "",

  // Access length for one payment
  DAYS_PER_MONTH: 30
};
