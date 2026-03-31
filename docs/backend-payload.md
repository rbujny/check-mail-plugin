# Dokumentacja Payloadu API (CheckMailPlugin -> Backend)

Wtyczka zbiera dane z różnych klientów pocztowych (Gmail, Outlook, WP, Onet, Interia, Yahoo, Proton), jednak przed wysłaniem ich do backendu przechodzą one przez **współdzielony optymalizator** (`email-data-optimizer.ts`).

Dzięki temu **format danych wysyłanych do backendu jest zawsze ujednolicony i identyczny dla każdego providera poczty**. Nie ma dedykowanego formatu na backendzie dla konkretnego dostawcy poczty — backend zawsze otrzymuje przewidywalny obiekt JSON.

## Zbierane dane (Zasady prywatności i bezpieczeństwa)
Zgodnie z założeniami projektu wtyczka **nie** przesyła pełnych treści maili, plików HTML ani surowych załączników. Payload jest redukowany tak, aby przesyłać tylko wektory ataku niezbędne do analizy pod kątem phishingu.

Z surowego maila usuwane są gigantyczne podpisy kryptograficzne (np. `DKIM-Signature`), a treść przechodzi sanitizację.

## Struktura wysyłanego zapytania (POST)

Zapytanie wysyłane jest metodą `POST` na adres `http://localhost:8080/process.php` z nagłówkiem `Content-Type: application/json`.

Oto dokładna struktura wysyłanego JSON-a (`ProcessedEmailData`):

```json
{
  "headers": {
    "from": "Scammer <attacker@phish.com>",
    "to": "victim@company.com",
    "subject": "Pilne: Zablokowano konto",
    "reply-to": "admin@phish-reply.com",
    "return-path": "<bounce@phish.com>"
  },
  "receivedChain": [
    "from mx.phish.com by mx.company.com with ESMTPS id abc123",
    "from internal.phish.com by mx.phish.com with ESMTP id xyz789"
  ],
  "securityVerdicts": {
    "spf": "fail",
    "dkim": "pass",
    "dmarc": "fail"
  },
  "body": "Szanowny kliencie, twoje konto zostalo zablokowane. Zaloguj sie na stronie: [LINK], podajac swoje haslo lub napisz do nas [LINK]. Z powazaniem administracja. [TRUNCATED]",
  "truncated": true,
  "links": [
    "https://phish.com/login-reset-token=123",
    "mailto:support@phish-reply.com"
  ]
}
```

### Opis Pól

| Pole | Typ | Opis |
|------|-----|------|
| `headers` | `Object` | Wyłącznie najważniejsze nagłówki nawigacyjne. Klucze są zawsze małymi literami. Obsługiwane klucze to: `from`, `to`, `subject`, `reply-to`, `return-path`. Reszta nagłówków jest odrzucana. |
| `receivedChain` | `Array<string>` | Tablica łańcuchów znaków zawierająca wszystkie nagłówki `Received:` z oryginalnego maila (określające ścieżkę serwerów, przez które przeszła wiadomość). |
| `securityVerdicts` | `Object` | Wyciągnięte werdykty bezpieczeństwa na podstawie nagłówka `Authentication-Results`. Może zawierać klucze `spf`, `dkim` i `dmarc` o wartościach takich jak np. `"pass"`, `"fail"`, `"softfail"`, `"none"`. Jeżeli dany werdykt był niedostępny, obiekt będzie pusty. |
| `body` | `string` | Oczyszczona z HTML-a treść maila (czysty tekst). **Limitowana do max. 1000 znaków.** Wszystkie linki w treści są podmieniane na słowo `[LINK]`, aby zaoszczędzić miejsce, a długie bloki spacji podmieniane na pojedyncze spacje. Jeżeli body zostało ucięte, na końcu dodawany jest znacznik `[TRUNCATED]`. |
| `truncated` | `boolean` | Flaga informująca backend (i ew. model LLM), czy oryginalna treść wiadomości przekraczała 1000 znaków i została sztucznie ucięta. |
| `links` | `Array<string>` | Wyekstrahowana i pozbawiona duplikatów tablica linków z treści maila. Wyciąga protokoły HTTP/HTTPS, wektory ukryte w `mailto:`, a także próby wstrzyknięcia skryptów przez `data:`. Maksymalnie przesyła do 50 adresów URL. Dodatkowo każdy najdłuższy link jest ograniczany do max. 2048 znaków, by zapobiec atakom "Payload DoS" na złośliwie wydłużonych adresach. |

## Różnice u poszczególnych dostawców poczty (Min vs Max Case)

Mimo że **format wyjściowy wysyłany do backendu w zapytaniu pozostaje zawsze identyczny**, istnieje olbrzymia różnica w tym, jak dużo danych dany webmail pozwala wyciągnąć ze swojego DOM w standardowym widoku (Min Case) w stosunku do widoku surowego "Pokaż źródło" / "Headers" (Max Case).

Poniżej zestawienie dla zagranicznych providerów (dane na podstawie logów z wtyczki). *Polscy dostawcy (WP, Onet, Interia) zostaną zaktualizowani w późniejszym terminie.*

### 1. Gmail
*   **Min Case (Widok standardowy):** Wtyczka wyciąga kompletne nagłówki podstawowe (`from`, `to`, `subject`), ładnie formatuje treść i wyciąga dziesiątki linków. Jednakże serwery przekierowań (`receivedChain`) oraz werdykty bezpieczeństwa (`securityVerdicts`) **zawsze są puste**, ponieważ interfejs Gmaila ich w ogóle nie ładuje dla klienta.
*   **Max Case (Pokaż oryginał / Show Original):** Znajdziemy tu pełen `receivedChain` (wszystkie hop-y IP serwerów pośrednich, zwykle 3-4 wpisy), kompletne werdykty w `securityVerdicts` (np. `"spf": "pass", "dkim": "pass", "dmarc": "pass"`) i dodatkowo zaawansowane nagłówki podstawowe pod kątem spoofingu, jak `return-path`.

### 2. Outlook
*   **Min Case:** Podobnie jak w Gmailu - backend otrzymuje czyste `body` z linkami oraz podstawowe nagłówki (ale "subject" czasem może polecieć pusty w skrajnych ułożeniach pociętego CSS'a). Brak łańcucha przekazywania `receivedChain`, brak security.
*   **Max Case (Wyświetl źródło):** Pełen, wyjątkowo długi `receivedChain` dochodzący do 5-6 wpisów (często przeplata się z dziesiątkami wewnętrznych serwerów bouncujących Microsoftu typu `*.prod.outlook.com`). Pełne `securityVerdicts` z kompletem walidacji kluczy podpisu.

### 3. Yahoo
*   **Min Case:** Yahoo w czystym widoku oddaje `from`, `to`, `subject` (często widocznym jest odcięcie reszty znaków), puste `receivedChain` i `securityVerdicts`.
*   **Max Case (View Raw Message):** Bardzo bogaty `receivedChain` i pełne werdykty sprawdzania kryptograficznego w `securityVerdicts`. Pokazuje często również precyzyjne odróżnienie atrybutów `reply-to` i ukrytego `return-path`, które nie występują w zwykłym trybie.

### 4. Proton (Wyjątek Architektoniczny!)
Ze względu na specyfikę szwajcarskiego klienta i End-to-End Encryption (PGP):
*   **Min Case:** Backend dostaje wyłącznie podstawowe `from`, `to`, puste `receivedChain` i `securityVerdicts`. Proton szyfruje cały payload klienta i podmienia DOM dynamicznie - w niektórych miejscach "surowe" zapytanie wyrzuci całkowicie puste `body: ""`.
*   **Max Case (Widok nagłówków):** W związku ze specyfiką warstwy szyfrowania, w oryginalnym e-mailu pobranym jako plain text `receivedChain` jest **zawsze puste lub maksymalnie jednoelementowe**, ponieważ węzły internetowe nie są logowane w ten sam sposób co w nieszyfrowanej poczcie. `securityVerdicts` odbija brak werdyktów domenowych.  
    **WAŻNE DLA BACKENDU:** W trybie MAX "surowe" nagłówki SMTP w Protonie lądują fizycznie scalone **na samej górze niesformatowanego stringa wewnątrz pola `body`**, po których tuż poniżej następuje blok danych `-----BEGIN PGP MESSAGE-----`. Wtedy zmienna blokowa `headers` dostanie zazwyczaj puste `{}`. Backend analizując ProtonMail musi być gotowy wyciągać te pola tekstem bezpośrednio ze szczytu pola `body`.

---

### Inne drobne anomalie i edge case'y
- **Ucięciodbiorcy**: Część dostawców poczty tnie pełne adresy "To/Cc" (pokazując np. same "Imię Nazwisko"). Pliki wtyczki starają się to korygować z ukrytych atrybutów frontowych, jednak w ekstremalnym przypadku kiedy adres absolutnie nie wycieka w DOM - w pole poleci flaga `"[extraction failed]"`. Zawsze jednak pole tekstowe jest zachowane, interfejs pozostaje rygorystyczny.
- **Puste Body**: Wiadomości scamerskie/phishingowe często składają się wyłącznie z jednego połączonego hiperłączem obrazka (aby uciec z radaru prostych filtrów spamowych OCR). Taka wiadomość wygeneruje pusty ciąg znaków `body: ""` ale wypchnie link w `links: ["..."]`. Back-end ewaluatorów ryzyka musi posiadać nadpisania obsługujące brak czystego tekstu ciała wiadomości.
