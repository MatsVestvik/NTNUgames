"""
Wavelength Spectrum Cards Library
Direct, punchy, and concrete opposing spectrum pairs (e.g. "Mild mat" - "Sterk mat").
"""

import random
from typing import Dict, List

SPECTRUM_CARDS: List[Dict[str, str]] = [
    # --- Mat & Drikke ---
    {"left": "Mild mat", "right": "Sterk mat", "category": "Mat & Drikke"},
    {"left": "Sunt", "right": "Usunt", "category": "Mat & Drikke"},
    {"left": "Søtt", "right": "Surt", "category": "Mat & Drikke"},
    {"left": "Kald mat", "right": "Varm mat", "category": "Mat & Drikke"},
    {"left": "Hverdagsmat", "right": "Festmat", "category": "Mat & Drikke"},
    {"left": "Tørr mat", "right": "Saftig mat", "category": "Mat & Drikke"},
    {"left": "Lite salt", "right": "Mye salt", "category": "Mat & Drikke"},
    {"left": "Lite krydret", "right": "Mye krydret", "category": "Mat & Drikke"},
    {"left": "Fastfood", "right": "Gourmetmat", "category": "Mat & Drikke"},
    {"left": "Svak kaffe", "right": "Sterk kaffe", "category": "Mat & Drikke"},
    {"left": "Billig middag", "right": "Dyr middag", "category": "Mat & Drikke"},
    {"left": "Enkel matrett", "right": "Avansert matrett", "category": "Mat & Drikke"},
    {"left": "Frokostmat", "right": "Nattmat", "category": "Mat & Drikke"},
    {"left": "God lukt", "right": "Vond lukt", "category": "Mat & Drikke"},
    {"left": "Mild smak", "right": "Kraftig smak", "category": "Mat & Drikke"},

    # --- Studentliv & Universitet ---
    {"left": "Lett fag", "right": "Vanskelig fag", "category": "Studentliv"},
    {"left": "Stå opp tidlig", "right": "Sove lenge", "category": "Studentliv"},
    {"left": "Rolig kveld", "right": "Vill fest", "category": "Studentliv"},
    {"left": "Latskap", "right": "Produktiv", "category": "Studentliv"},
    {"left": "Lite pensum", "right": "Mye pensum", "category": "Studentliv"},
    {"left": "Lett eksamen", "right": "Tøff eksamen", "category": "Studentliv"},
    {"left": "Dårlig råd", "right": "God råd", "category": "Studentliv"},
    {"left": "Trang hybel", "right": "Romslig leilighet", "category": "Studentliv"},
    {"left": "Stille lesesal", "right": "Bråkete kantine", "category": "Studentliv"},
    {"left": "Kort forelesning", "right": "Lang forelesning", "category": "Studentliv"},
    {"left": "Dårlig karakter", "right": "God karakter", "category": "Studentliv"},
    {"left": "Lavt stress", "right": "Høyt stress", "category": "Studentliv"},

    # --- Hverdag & Egenskaper ---
    {"left": "Kaldt", "right": "Varmt", "category": "Hverdag"},
    {"left": "Billig", "right": "Dyrt", "category": "Hverdag"},
    {"left": "Stille", "right": "Bråkete", "category": "Hverdag"},
    {"left": "Liten", "right": "Stor", "category": "Hverdag"},
    {"left": "Myk", "right": "Hard", "category": "Hverdag"},
    {"left": "Mørkt", "right": "Lyst", "category": "Hverdag"},
    {"left": "Treg", "right": "Rask", "category": "Hverdag"},
    {"left": "Tungt", "right": "Lett", "category": "Hverdag"},
    {"left": "Gammelt", "right": "Nytt", "category": "Hverdag"},
    {"left": "Kort", "right": "Langt", "category": "Hverdag"},
    {"left": "Skittent", "right": "Rent", "category": "Hverdag"},
    {"left": "Tynt", "right": "Tjukt", "category": "Hverdag"},
    {"left": "Vått", "right": "Tørt", "category": "Hverdag"},
    {"left": "Lavt", "right": "Høyt", "category": "Hverdag"},
    {"left": "Skjørt", "right": "Robust", "category": "Hverdag"},
    {"left": "Glatt", "right": "Ru", "category": "Hverdag"},
    {"left": "Vinter", "right": "Sommer", "category": "Hverdag"},
    {"left": "Kort reise", "right": "Lang reise", "category": "Hverdag"},

    # --- Personlighet & Sosiale situasjoner ---
    {"left": "Snill", "right": "Slem", "category": "Personlighet"},
    {"left": "Umoden", "right": "Voksen", "category": "Personlighet"},
    {"left": "Introvert", "right": "Ekstrovert", "category": "Personlighet"},
    {"left": "Rolig person", "right": "Hissig person", "category": "Personlighet"},
    {"left": "Lite sosial", "right": "Veldig sosial", "category": "Personlighet"},
    {"left": "Lite ambisiøs", "right": "Superambisiøs", "category": "Personlighet"},
    {"left": "Uformell", "right": "Formell", "category": "Personlighet"},
    {"left": "Feig", "right": "Modig", "category": "Personlighet"},
    {"left": "Kjedelig person", "right": "Spennende person", "category": "Personlighet"},
    {"left": "Lite tiltrekkende", "right": "Veldig tiltrekkende", "category": "Personlighet"},
    {"left": "Kald personlighet", "right": "Varm personlighet", "category": "Personlighet"},
    {"left": "Lite fleksibel", "right": "Veldig fleksibel", "category": "Personlighet"},
    {"left": "Uærlig", "right": "Ærlig", "category": "Personlighet"},
    {"left": "Flaut øyeblikk", "right": "Stolt øyeblikk", "category": "Personlighet"},
    {"left": "Første date", "right": "Gammelt ektepar", "category": "Personlighet"},

    # --- Meninger & Verdier ---
    {"left": "Dårlig film", "right": "Bra film", "category": "Meninger"},
    {"left": "Stygt", "right": "Pent", "category": "Meninger"},
    {"left": "Kjedelig samtale", "right": "Spennende samtale", "category": "Meninger"},
    {"left": "Undervurdert", "right": "Overvurdert", "category": "Meninger"},
    {"left": "Dårlig vane", "right": "God vane", "category": "Meninger"},
    {"left": "Ufarlig løgn", "right": "Alvorlig løgn", "category": "Meninger"},
    {"left": "Lett å tilgi", "right": "Vanskelig å tilgi", "category": "Meninger"},
    {"left": "Avslappende", "right": "Stressende", "category": "Meninger"},
    {"left": "Upopulær mening", "right": "Populær mening", "category": "Meninger"},
    {"left": "God humor", "right": "Dårlig humor", "category": "Meninger"},
    {"left": "Tørr humor", "right": "Morsom humor", "category": "Meninger"},
    {"left": "Lite viktig", "right": "Livsviktig", "category": "Meninger"},
    {"left": "Lite moralsk", "right": "Veldig moralsk", "category": "Meninger"},
    {"left": "Lav status", "right": "Høy status", "category": "Meninger"},
    {"left": "Kjedelig jobb", "right": "Drømmejobb", "category": "Meninger"},
    {"left": "Ubetydelig", "right": "Historisk", "category": "Meninger"},

    # --- Popkultur & Underholdning ---
    {"left": "Kjedelig spill", "right": "Morsomt spill", "category": "Underholdning"},
    {"left": "Enkelt spill", "right": "Avansert spill", "category": "Underholdning"},
    {"left": "Ubrukelig superkraft", "right": "Beste superkraft", "category": "Underholdning"},
    {"left": "Kjedelig hobby", "right": "Morsom hobby", "category": "Underholdning"},
    {"left": "Lite skummel film", "right": "Veldig skummel film", "category": "Underholdning"},
    {"left": "Dårlig sang", "right": "Fantastisk sang", "category": "Underholdning"},
    {"left": "Kort sang", "right": "Lang sang", "category": "Underholdning"},
    {"left": "Ukjent kjendis", "right": "Verdenskjent kjendis", "category": "Underholdning"},
    {"left": "Gammel teknologi", "right": "Moderne teknologi", "category": "Underholdning"},
    {"left": "Lite nerdete", "right": "Veldig nerdete", "category": "Underholdning"},
    {"left": "Lite minneverdig", "right": "Uforglemmelig", "category": "Underholdning"},
    {"left": "Lettlest bok", "right": "Tunglest bok", "category": "Underholdning"},

    # --- Dyr & Natur ---
    {"left": "Trygt dyr", "right": "Farlig dyr", "category": "Dyr & Natur"},
    {"left": "Lite skummelt dyr", "right": "Livsfarlig dyr", "category": "Dyr & Natur"},
    {"left": "Lite dyr", "right": "Stort dyr", "category": "Dyr & Natur"},
    {"left": "Tregt dyr", "right": "Raskt dyr", "category": "Dyr & Natur"},
    {"left": "Stille dyr", "right": "Bråkete dyr", "category": "Dyr & Natur"},
    {"left": "Tam", "right": "Vill", "category": "Dyr & Natur"},
    {"left": "Søtt dyr", "right": "Ekkelt dyr", "category": "Dyr & Natur"},
    {"left": "Svakt dyr", "right": "Sterkt dyr", "category": "Dyr & Natur"},
]


def get_random_spectrum_card() -> Dict[str, str]:
    """Return a randomly chosen spectrum pair."""
    card = random.choice(SPECTRUM_CARDS)
    # 50% chance to flip left/right for even more variety
    if random.random() < 0.5:
        return {
            "left": card["right"],
            "right": card["left"],
            "category": card["category"],
        }
    return dict(card)
