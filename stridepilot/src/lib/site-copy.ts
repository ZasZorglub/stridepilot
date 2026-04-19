import { SiteLocale } from "./site-variant";

export function getSiteCopy(locale: SiteLocale) {
  if (locale === "en") {
    return {
      appDescription: "Get a running plan that fits you. StridePilot builds your plan based on your level and goals. It adapts over time based on how your training goes.",
      welcomeSubhead: "Get a running plan that fits you",
      welcomeExplainerLines: [
        "StridePilot builds your plan based on your level and goals.",
        "It adapts over time based on how your training goes.",
      ],
      startLabel: "Get started",
      demoLabel: "Try demo",
      welcomeTitle: "Welcome to StridePilot",
      authSubtitle: "Get a running plan that fits you.",
      emailLabel: "Email address",
      passwordLabel: "Password",
      signUpLabel: "Create free account",
      loginLabel: "Log in",
      alreadyAccount: "Already have an account?",
      newHere: "New here?",
      introTitle: "Before we start",
      introBody: "You’ll answer a few short questions.",
      introBullets: [
        "Answer as realistically as possible.",
        "Then you’ll get a plan tailored to you.",
      ],
      betaTesterInstructions:
        "Beta tips: start from your real current level, keep post-workout feedback honest, and tell us if anything feels unclear or untrustworthy.",
      postSignupGuidance:
        "You’ll get the most useful plan if you answer calmly and realistically. StridePilot is designed to be conservative early and clearer over the first few weeks.",
      redditInvite:
        "StridePilot is opening a small English beta for runners who want a calmer, more coach-like training app. If you try it, I’d love feedback on trust, clarity, and whether the plan feels like something a real coach could have written.",
      feedbackPrompt:
        "What felt strong, confusing, or not coach-credible? A few honest lines are more useful than a polished review.",
    };
  }

  return {
    appDescription: "Adaptivt løbeprogram med guidede træningspas, coach-lignende feedback og rolig progression.",
    welcomeSubhead: "Din adaptive løbeapp",
    welcomeExplainerLines: [
      "StridePilot bygger en løbeplan ud fra dit niveau og dit mål.",
      "Den justerer sig over tid ud fra din træning.",
    ],
    startLabel: "Kom i gang",
    demoLabel: "Prøv demo",
    welcomeTitle: "Velkommen til StridePilot",
    authSubtitle: "StridePilot bygger en løbeplan ud fra dit niveau og dit mål.",
    emailLabel: "E-mailadresse",
    passwordLabel: "Adgangskode",
    signUpLabel: "Opret gratis konto",
    loginLabel: "Log ind",
    alreadyAccount: "Har du allerede en konto?",
    newHere: "Ny her?",
    introTitle: "Før vi starter",
    introBody: "Du svarer på et par korte spørgsmål.",
    introBullets: [
      "Svar så realistisk som muligt.",
      "Så får du en plan, der er tilpasset til dig.",
    ],
    betaTesterInstructions:
      "Beta-tip: start ud fra dit ærlige nuværende niveau, log dine pas roligt, og sig til hvis noget føles uklart eller utroværdigt.",
    postSignupGuidance:
      "Du får det bedste program, når du svarer roligt og realistisk. StridePilot er bevidst konservativ i starten og bliver tydeligere, når den har lært lidt om dig.",
    redditInvite:
      "StridePilot åbner en lille engelsk beta for løbere, der vil have en roligere og mere coach-lignende træningsapp.",
    feedbackPrompt:
      "Hvad føltes stærkt, uklart eller ikke coach-troværdigt? Et par ærlige linjer er mere nyttige end en poleret anmeldelse.",
  };
}
