// The Car Helper's brain. It looks for key words in what the driver typed and
// answers with a plain-English explanation. It is NOT a real AI: it only knows
// the problems listed below. (The PRD's real triage in F1 comes later.)

export type Reply = {
  headline: string;
  explanation: string;
  // Controls the color of the safety note: green, orange, red or grey.
  level: "ok" | "careful" | "stop" | "unsure";
  safety: string;
  nextStep: string;
};

type Problem = { keywords: string[]; reply: Reply };

// Checked first. If any of these match, we always show the emergency answer.
const EMERGENCY: Problem = {
  keywords: [
    "on fire",
    "caught fire",
    "flames",
    "no brakes",
    "brakes failed",
    "brakes not working",
    "brake pedal goes to the floor",
    "cant steer",
    "lost steering",
  ],
  reply: {
    headline: "This sounds like an emergency",
    explanation:
      "Fire, no brakes, or losing steering can be dangerous very quickly.",
    level: "stop",
    safety: "Pull over somewhere safe, turn the car off, and get everyone away from the road.",
    nextStep: "Call 911 if there is fire or you can't stop. Once you're safe, we can send a mechanic.",
  },
};

// If two problems match equally, the one higher in this list wins.
const PROBLEMS: Problem[] = [
  {
    keywords: ["white smoke", "steam", "smoke under the hood", "smoke from the hood", "sweet smell"],
    reply: {
      headline: "Steam or white smoke from the engine",
      explanation:
        "This usually means coolant (the liquid that keeps your engine cool) is leaking onto hot parts, or the engine is overheating. A cracked hose or a bad radiator cap are common causes. (Thin white vapor from the tailpipe on a cold morning is normal and goes away.)",
      level: "stop",
      safety: "Pull over and turn the engine off. Don't open the radiator cap while it's hot, because it can spray scalding liquid.",
      nextStep: "Let it cool for about 30 minutes, then have a mechanic look at it before you drive again.",
    },
  },
  {
    keywords: ["black smoke"],
    reply: {
      headline: "Black smoke from the exhaust",
      explanation:
        "The engine is getting too much fuel. A dirty air filter or a leaky fuel injector are the usual reasons.",
      level: "careful",
      safety: "It's usually okay to drive a short way, but your gas mileage will drop and it can get worse.",
      nextStep: "Book a mechanic to check the air filter and fuel system soon.",
    },
  },
  {
    keywords: ["blue smoke", "gray smoke", "grey smoke"],
    reply: {
      headline: "Blue or gray smoke from the exhaust",
      explanation:
        "Your engine is probably burning oil. Worn engine seals or piston rings can let oil leak into the engine.",
      level: "careful",
      safety: "Check your oil level when the engine is cool. If it's very low, don't drive until you add oil.",
      nextStep: "Have a mechanic check for oil leaks and worn seals.",
    },
  },
  {
    keywords: ["smoke"],
    reply: {
      headline: "Smoke can mean a few different things",
      explanation:
        "The color and where it comes from matter. White usually means coolant, black means too much fuel, and blue means burning oil.",
      level: "stop",
      safety: "If smoke is coming from the engine area, pull over safely and turn the engine off.",
      nextStep: "Tell me the color and where you see it, and I can tell you more.",
    },
  },
  {
    keywords: ["wont start", "will not start", "doesnt start", "cant start", "wont turn over", "clicking", "click when", "dead battery", "battery is dead", "no crank", "slow crank"],
    reply: {
      headline: "Your car won't start",
      explanation:
        "If you hear clicking or the engine turns over slowly, the battery is probably weak or the battery clamps are loose or rusty. If nothing happens and the lights are dead, the battery is likely empty. If it cranks but never catches, it could be a fuel or spark problem.",
      level: "ok",
      safety: "You're not in danger, you just can't drive it yet.",
      nextStep: "A mobile mechanic can test the battery and jump or replace it right where you are.",
    },
  },
  {
    keywords: ["brake", "grinding when i stop", "squeal when i stop"],
    reply: {
      headline: "Something's wrong with your brakes",
      explanation:
        "Squealing usually means the brake pads are getting thin. Grinding means they're worn down to metal and can damage the discs. A soft or spongy pedal can mean air or low fluid in the brake lines.",
      level: "careful",
      safety: "Drive slowly and leave extra space. If the pedal feels soft or sinks, don't drive.",
      nextStep: "Get your brakes checked soon. A mechanic can replace pads at your location.",
    },
  },
  {
    keywords: ["squeal", "squeak", "chirp", "screech"],
    reply: {
      headline: "A squealing or chirping sound",
      explanation:
        "A squeal when you start the car or turn the steering wheel is often a worn or loose belt. The belt runs things like the alternator and power steering.",
      level: "careful",
      safety: "You can usually drive for a short while, but if the belt snaps the car can lose power steering and the battery will stop charging.",
      nextStep: "Have the belt checked soon. It's a quick fix.",
    },
  },
  {
    keywords: ["overheat", "temperature gauge", "running hot", "engine is hot", "temp light", "hot engine"],
    reply: {
      headline: "Your engine is overheating",
      explanation:
        "The engine is getting too hot. Low coolant, a leak, a bad thermostat, or a broken fan are the usual causes.",
      level: "stop",
      safety: "Pull over and turn the engine off. Driving hot can ruin the engine.",
      nextStep: "Wait for it to cool, then call a mechanic. Don't open the radiator cap while it's hot.",
    },
  },
  {
    keywords: ["check engine", "engine light", "service engine", "engine warning"],
    reply: {
      headline: "The check engine light is on",
      explanation:
        "Your car's computer found a problem. It can be small, like a loose gas cap, or bigger, like a bad sensor or worn spark plugs. A mechanic reads a code to find out which.",
      level: "careful",
      safety: "If the light stays steady, you can usually drive to get it checked soon. If it's flashing, stop driving, because it can damage the engine.",
      nextStep: "Check that your gas cap is tight, then book a code scan.",
    },
  },
  {
    keywords: ["battery light", "battery warning", "charging light", "alternator"],
    reply: {
      headline: "The battery light is on",
      explanation:
        "That usually means the car isn't charging its battery. The alternator or the belt that spins it is the likely cause.",
      level: "careful",
      safety: "The car will run on the battery for a little while and then die. Turn off the AC and radio and get somewhere safe.",
      nextStep: "A mechanic can test the alternator on site.",
    },
  },
  {
    keywords: ["oil light", "oil pressure", "oil warning"],
    reply: {
      headline: "The oil warning light is on",
      explanation:
        "Your engine may be low on oil or not getting oil pressure. Running like that can ruin an engine fast.",
      level: "stop",
      safety: "Pull over and turn the engine off.",
      nextStep: "When it's cool, check the oil with the dipstick. If it's low, add oil. If the light stays on, don't drive.",
    },
  },
  {
    keywords: ["flat", "tire", "tyre", "tpms", "pressure light", "losing air"],
    reply: {
      headline: "A tire problem",
      explanation:
        "A flat or slowly leaking tire is most often a nail or screw, a bad valve stem, or a tire that has lost its seal on the wheel.",
      level: "careful",
      safety: "Don't drive on a flat tire, because it can wreck the wheel. A tire that's just a bit low can usually make it to a safe place.",
      nextStep: "A mechanic can patch or swap the tire where you're parked.",
    },
  },
  {
    keywords: ["shake", "shaking", "vibrat", "wobble", "shudder"],
    reply: {
      headline: "Shaking or vibration",
      explanation:
        "Shaking at highway speed is often unbalanced tires. Shaking only when you brake usually points to warped brake discs. Shaking when stopped can mean worn spark plugs or engine mounts.",
      level: "careful",
      safety: "Slow down and avoid highways until it's checked.",
      nextStep: "Tell me when it shakes (speed, braking, or sitting still) and a mechanic can narrow it down.",
    },
  },
  {
    keywords: ["burning smell", "smell burning", "smells like burning", "burning rubber", "burnt"],
    reply: {
      headline: "A burning smell",
      explanation:
        "Burning rubber can be a slipping belt or a hose touching something hot. A burning oil smell can be oil leaking onto the hot engine. A sharp plastic or electrical smell can mean a wiring problem.",
      level: "careful",
      safety: "If it smells like electrical or plastic, stop and turn the car off.",
      nextStep: "Look for smoke or drips, and have a mechanic check it soon.",
    },
  },
  {
    keywords: ["leak", "puddle", "dripping", "fluid"],
    reply: {
      headline: "A fluid leak",
      explanation:
        "The color tells you a lot. Green, orange or pink is usually coolant. Brown or black is usually oil. Red or reddish-brown can be transmission or power steering fluid. Clear water under the front is usually normal AC water.",
      level: "careful",
      safety: "If the fluid is clear and slippery near a wheel, it could be brake fluid. Don't drive in that case.",
      nextStep: "Tell me the color and where it is, and a mechanic can find the source.",
    },
  },
  {
    keywords: ["knock", "ticking", "tapping", "clunk", "rattle"],
    reply: {
      headline: "A knocking, ticking or clunking noise",
      explanation:
        "Ticking can mean low oil or worn engine parts. A clunk over bumps often means worn suspension parts. A deep knock from the engine can be serious.",
      level: "careful",
      safety: "Check your oil. If there's a deep knock from the engine, stop driving.",
      nextStep: "Have a mechanic listen to it in person.",
    },
  },
  {
    keywords: ["stall", "rough idle", "hesitat", "jerk", "sputter"],
    reply: {
      headline: "The engine is stalling or running rough",
      explanation:
        "A dirty fuel filter, old spark plugs, or a bad sensor can all make an engine stumble or cut out.",
      level: "careful",
      safety: "Stalling in traffic is risky. Avoid busy roads until it's fixed.",
      nextStep: "Book a mechanic to check the fuel and spark systems.",
    },
  },
  {
    keywords: ["pulls to", "pulling to", "drifts"],
    reply: {
      headline: "The car pulls to one side",
      explanation:
        "Uneven tire pressure or a bad wheel alignment are the usual causes. A sticking brake can do it too.",
      level: "ok",
      safety: "It's usually safe to drive, but check your tire pressure first.",
      nextStep: "If the pressure is even, get an alignment check.",
    },
  },
];

const NOT_SURE: Reply = {
  headline: "I'm not sure yet",
  explanation:
    "I can't tell what's wrong from that. It helps to know what you see, hear or smell, and when it happens.",
  level: "unsure",
  safety: "If it feels unsafe to drive, trust your gut and stop somewhere safe.",
  nextStep: "Try describing it another way, or book a diagnostic visit and a mechanic will take a look in person.",
};

function clean(text: string) {
  // "won't" -> "wont", so keywords don't need apostrophes.
  return text.toLowerCase().replace(/['’]/g, "");
}

// Matches the start of a word, so "tire" matches "tires" but not "entire".
function hasWord(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + escaped).test(text);
}

function score(text: string, problem: Problem) {
  return problem.keywords.filter((k) => hasWord(text, k)).length;
}

export function diagnose(message: string): Reply {
  const text = clean(message);

  if (score(text, EMERGENCY) > 0) return EMERGENCY.reply;

  let best: Problem | null = null;
  let bestScore = 0;
  for (const problem of PROBLEMS) {
    const s = score(text, problem);
    if (s > bestScore) {
      best = problem;
      bestScore = s;
    }
  }
  return best ? best.reply : NOT_SURE;
}
