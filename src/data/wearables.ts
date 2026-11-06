/**
 * wearables — what each wearable writes to the phone's health store, reading
 * by reading, and what Verve makes of it. One table, two pages: the science
 * topic (/science/sleep-heart/wearables) and How it works (4 Nov 2026).
 *
 * Reading · Apple Watch · WHOOP · Oura · Garmin · Fitbit and Pixel Watch (the
 * Google Health app) · Galaxy Watch (Samsung Health) · what Verve makes of it.
 * "Not listed" means the reading is not on the maker's own published list
 * for that store when it was checked (2–3 November 2026); an app may still
 * write it, and Verve reads whatever is there.
 *
 * The background-movement row (6 Nov 2026) is not a reading of its own: it
 * says whether a wearable shares the two readings that figure is made from,
 * heart rate BETWEEN sessions and steps. It follows the heart-rate row above
 * it; Oura's one-minute heart rate and its write-on-sync were read on Oura's
 * support page that day. How-it-works carries the note on when to look.
 */
export const WEARABLE_ROWS: [string, string, string, string, string, string, string, string][] = [
  ["Workouts, with heart rate inside the session", "Yes", "Yes: started sessions, both stores", "Yes, both stores", "Yes, both stores", "Yes, both stores", "Yes", "Zone 2, the band split, heart rate recovery and the weekly dose all start here"],
  ["What the workout's energy figure holds", "Above rest: Verve adds the resting MET", "Rest included: read as it is", "Above rest, as the store defines the field", "Above rest, as the store defines the field", "Health Connect: total calories only, so the Compendium value stands in; Apple Health: not confirmed", "Not listed; the Compendium value stands in", "The session's MET, so its class and its MET-minutes"],
  ["Heart rate through the day and asleep", "Yes", "No: inside started sessions only", "Yes, one-minute heart rate", "Yes, all day", "Yes", "Yes", "Sleeping heart rate on the Sleep page; the Vitals card"],
  ["Enough for background movement: heart rate between sessions, with steps", "Yes, written through the day", "No: nothing between sessions", "Yes, once the ring has synced to its app", "Yes, once the watch has synced; how fine is not published", "Yes, through Health Connect", "Yes, through Health Connect", "Movement outside logged sessions, counted once the day is complete: look the next day"],
  ["Resting heart rate", "Yes", "Yes", "Yes, the night's", "Not listed", "Yes", "Not listed", "Against your own last 30 nights"],
  ["Night HRV", "Yes, SDNN", "No: kept in the WHOOP app", "Health Connect yes (rMSSD); not in its Apple Health list", "No", "Health Connect yes; Apple Health not confirmed", "Not listed", "Your own baseline, one writer at a time; SDNN and rMSSD never mixed"],
  ["Sleep: duration, bedtime, wakes", "Yes", "Yes: one asleep block with its wakes", "Yes", "Yes", "Yes", "Yes", "Timing, regularity, efficiency"],
  ["Sleep stages", "Yes", "No: kept in the WHOOP app", "Yes", "Apple Health yes; Health Connect not confirmed", "Health Connect yes; Apple Health not confirmed", "Yes", "The stage split on the Sleep page; never from a WHOOP"],
  ["Breathing rate in sleep", "Yes", "Yes", "Apple Health yes; Health Connect not listed", "No", "Health Connect yes; Apple Health in the vitals it writes", "Not listed", "A Vitals row"],
  ["Blood oxygen", "Yes, on models that measure it", "Yes", "Not listed: kept in the Oura app", "No", "No: Google Health reads it from Health Connect but does not write it", "Yes", "A Vitals row from 1.7"],
  ["Wrist or skin temperature", "Yes: sleeping wrist temperature, Series 8 and later", "No: kept in the WHOOP app", "No: kept in the Oura app", "No", "Health Connect yes, skin temperature; Apple Health not confirmed", "Not listed", "A Vitals row: Apple's sleeping wrist temperature on iPhone, skin temperature on Android"],
  ["VO₂max from the wearable", "Yes: cardio fitness", "No", "No: Oura imports Apple's cardio fitness instead", "No: kept in Garmin Connect", "Health Connect yes; Apple Health not confirmed", "Not listed", "Secondary to the fitness test, with its 7 to 16% error named"],
  ["Steps", "Yes, by the minute (the iPhone too)", "One block a day, written the morning after, both stores", "Yes; how fine is not published", "Yes; how fine is not published", "Yes, and step cadence on Android", "Yes, by the minute", "The total from one writer a day; cadence, sitting hours and bouts only from steps by the minute"],
  ["All-day energy, for physical activity level", "Yes: active and resting", "No: workout energy only, so PAL is withheld", "Active energy yes, resting no: PAL on your profile's BMR", "Active energy yes, resting no: PAL on your profile's BMR", "Health Connect: total calories, not active, so PAL is not read; Apple Health not confirmed", "Resting rate yes; active not confirmed", "Physical activity level, each day on its own denominator"],
  ["Stand minutes", "Yes", "No", "No", "No", "No", "No store on Android carries it", "The Standing tile, Apple Watch only"],
  ["Weight, body fat, lean mass", "From a scale or typed, not the watch", "Health Connect: weight and lean mass; Apple Health: reads yours", "Weight and height", "Weight and body fat", "Weight and body fat", "Weight, body fat, height", "Body markers, read live from the store's log"],
];
export const WEARABLE_COLS = ["Reading", "Apple Watch", "WHOOP", "Oura", "Garmin", "Fitbit, Pixel Watch", "Galaxy Watch", "In Verve"];
export const WEARABLE_COL_IDS = ["", "apple-watch", "whoop", "oura", "garmin", "fitbit", "galaxy-watch", ""];
