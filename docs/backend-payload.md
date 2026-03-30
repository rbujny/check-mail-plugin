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

## Różnice u poszczególnych dostawców poczty (Provider Quirks)

Mimo że **format wyjściowy wysyłany do backendu w zapytaniu pozostaje zawsze identyczny**, istnieje kilka niuansów dotyczących tego, jak dobrze danemu providerowi (jego parserom na froncie) udaje się zebrać pełnię informacji:

1. **Widok "Pokaż źródło" vs "Standard"**: U większości providerów wtyczka obsługuje 2 tryby - widok standardowego maila w przeglądarce i zaawansowany widok nagłówków (tzw. "pokaż źródło wiadomości"). W trybie standardowym (normalne wejście w maila), klucze `receivedChain` i `securityVerdicts` przeważnie będą puste, ponieważ te informacje nie ulegają wyrenderowaniu przez interfejs webowy (frontend poczty po prostu ich nie pobiera).
2. **Ucięciodbiorcy**: Część dostawców poczty ucina pełne adresy "To/Cc" (pokazując np. same "Imię Nazwisko"). Pliki `*-extractor.ts` starają się to korygować z ukrytych atrybutów DOM, jednak jeśli jest to nieskuteczne w pole trafia znacznik `"[extraction failed]"`. Zawsze jednakże zachowany i uzupełniony zostaje typ tekstowy.
3. **Puste Body**: Maile składające się wyłącznie z pojedynczego obrazka zaowocują pustym ciągiem `body: ""`. Back-end powinien być na to odporny.
