"""
Curated Norwegian Word Pairs for Imposter (Tegn-Imposter).
Each entry is (Category, WordA, WordB).
Crew receives one word, and the Imposter receives the related decoy word
from the same pair (along with knowing they are the Imposter).
"""

import random
from typing import Dict, List, Tuple

WORD_PAIRS: List[Tuple[str, str, str]] = [
    # Dyr
    ("Dyr", "Katt", "Hund"),
    ("Dyr", "Elg", "Hjort"),
    ("Dyr", "Pingvin", "Lundefugl"),
    ("Dyr", "Hai", "Delfin"),
    ("Dyr", "Løve", "Tiger"),
    ("Dyr", "Elefant", "Neshorn"),
    ("Dyr", "Krokodille", "Øgle"),
    ("Dyr", "Bie", "Veps"),
    ("Dyr", "Sommerfugl", "Øyenstikker"),
    ("Dyr", "Bjørn", "Isbjørn"),
    ("Dyr", "Kamel", "Lama"),
    ("Dyr", "Krabbe", "Hummer"),
    ("Dyr", "Blekksprut", "Manet"),
    ("Dyr", "Ugle", "Ørn"),
    ("Dyr", "Frosk", "Skilpadde"),
    ("Dyr", "Ekorn", "Pinnsvin"),
    ("Dyr", "Sau", "Geit"),
    ("Dyr", "Hest", "Sebradyr"),
    ("Dyr", "Slange", "Meitemark"),
    ("Dyr", "Flamingo", "Svane"),

    # Mat & Drikke
    ("Mat & Drikke", "Pizza", "Hamburger"),
    ("Mat & Drikke", "Taco", "Burrito"),
    ("Mat & Drikke", "Vaffel", "Pannekake"),
    ("Mat & Drikke", "Iskrem", "ollipop"),
    ("Mat & Drikke", "Kaffekopp", "Tekopp"),
    ("Mat & Drikke", "Eple", "Pære"),
    ("Mat & Drikke", "Banan", "Agurk"),
    ("Mat & Drikke", "Jordbær", "Bringebær"),
    ("Mat & Drikke", "Gulrot", "Maiskolbe"),
    ("Mat & Drikke", "Brunost", "Gulost"),
    ("Mat & Drikke", "Pølse i brød", "Baguette"),
    ("Mat & Drikke", "Kanelbolle", "Smultring"),
    ("Mat & Drikke", "Popcorn", "Potetgull"),
    ("Mat & Drikke", "Ananas", "Kokosnøtt"),
    ("Mat & Drikke", "Speilegg", "Omelett"),
    ("Mat & Drikke", "Sushi", "Fiskepinner"),
    ("Mat & Drikke", "Sjokoladeplate", "Kjeks"),
    ("Mat & Drikke", "Brusboks", "Melkekartong"),

    # Kjøretøy & Transport
    ("Kjøretøy", "Sykkel", "Sparkesykkel"),
    ("Kjøretøy", "Helikopter", "Fly"),
    ("Kjøretøy", "Seilbåt", "Robåt"),
    ("Kjøretøy", "Tog", "Trikk"),
    ("Kjøretøy", "Traktor", "Gravemaskin"),
    ("Kjøretøy", "Luftballong", "Fallskjerm"),
    ("Kjøretøy", "Ubåt", "Cruiseskip"),
    ("Kjøretøy", "Rullebrett", "Rulleskøyter"),
    ("Kjøretøy", "Ambulanse", "Brannbil"),
    ("Kjøretøy", "Romrakett", "UFO"),

    # Ting & Hverdag
    ("Hverdagsting", "Solbriller", "Skibriller"),
    ("Hverdagsting", "Tannbørste", "Hårbørste"),
    ("Hverdagsting", "Paraply", "Parasoll"),
    ("Hverdagsting", "Stearinlys", "Lommelykt"),
    ("Hverdagsting", "Gitar", "Fiolin"),
    ("Hverdagsting", "Trommer", "Piano"),
    ("Hverdagsting", "Hodetelefoner", "Høyttaler"),
    ("Hverdagsting", "Armbåndsur", "Vekkerklokke"),
    ("Hverdagsting", "Ryggsekk", "Koffert"),
    ("Hverdagsting", "Saks", "Kniv"),
    ("Hverdagsting", "Hammer", "Øks"),
    ("Hverdagsting", "Nøkkel", "Hengelås"),
    ("Hverdagsting", "Støvsuger", "Feiekost"),
    ("Hverdagsting", "Bøtte", "Vannkanne"),
    ("Hverdagsting", "Fotball", "Basketball"),
    ("Hverdagsting", "Tennisracket", "Golfkølle"),
    ("Hverdagsting", "Fiskestang", "Hov"),
    ("Hverdagsting", "Kikkert", "Forstørrelsesglass"),

    # Natur & Steder
    ("Natur & Steder", "Vulkan", "Fjell"),
    ("Natur & Steder", "Palme", "Grantre"),
    ("Natur & Steder", "Snømann", "Iglo"),
    ("Natur & Steder", "Regnbue", "Nordlys"),
    ("Natur & Steder", "Bål", "Peis"),
    ("Natur & Steder", "Telt", "Hytte"),
    ("Natur & Steder", "Fyrtårn", "Vindmølle"),
    ("Natur & Steder", "Slott", "Kirke"),
    ("Natur & Steder", "Kaktus", "Solsikke"),
    ("Natur & Steder", "Fluesopp", "Kantarell"),
    ("Natur & Steder", "Måne", "Sol"),
    ("Natur & Steder", "Tordensky", "Tornado"),

    # Karakterer & Klær
    ("Klær & Figurer", "Trollmann", "Heks"),
    ("Klær & Figurer", "Pirat", "Viking"),
    ("Klær & Figurer", "Krone", "Flosshatt"),
    ("Klær & Figurer", "Slips", "Sløyfe"),
    ("Klær & Figurer", "Votter", "Hansker"),
    ("Klær & Figurer", "Gummistøvler", "Joggesko"),
    ("Klær & Figurer", "Spøkelse", "Skjelett"),
    ("Klær & Figurer", "Robot", "Romvesen"),
]


def get_random_imposter_pair() -> Dict[str, str]:
    """Return a random category, crew_word, and imposter_word."""
    category, w1, w2 = random.choice(WORD_PAIRS)
    # Fix typo if any
    if w2 == "ollipop":
        w2 = "Kjærlighet på pinne"
    if random.random() < 0.5:
        crew_word, imposter_word = w1, w2
    else:
        crew_word, imposter_word = w2, w1
    return {
        "category": category,
        "crew_word": crew_word,
        "imposter_word": imposter_word,
    }


def is_matching_word(guess: str, target: str) -> bool:
    """Check if the Imposter's guess matches the Crew's secret word."""
    g = guess.strip().lower().replace("-", " ")
    t = target.strip().lower().replace("-", " ")
    g = " ".join(g.split())
    t = " ".join(t.split())
    if not g or not t:
        return False
    if g == t:
        return True
    # Allow definite/indefinite Norwegian suffix or 1-char typo for words >= 6 chars
    if len(t) >= 5 and (g == t + "en" or g == t + "a" or g == t + "et" or t == g + "en" or t == g + "a" or t == g + "et"):
        return True
    if len(t) >= 6 and abs(len(g) - len(t)) <= 1:
        # Levenshtein distance <= 1
        dp = list(range(len(t) + 1))
        for i, cg in enumerate(g, 1):
            new_dp = [i]
            for j, ct in enumerate(t, 1):
                cost = 0 if cg == ct else 1
                new_dp.append(min(new_dp[-1] + 1, dp[j] + 1, dp[j - 1] + cost))
            dp = new_dp
        if dp[-1] <= 1:
            return True
    return False

