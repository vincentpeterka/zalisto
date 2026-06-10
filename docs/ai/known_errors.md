# Known Errors — Zalisto

Formát záznamu:
```
## [KÓDY CHYBY / symptom]
**Signature:** konkrétní error message nebo symptom
**Context:** kdy k tomu dochází
**Cause:** příčina
**Solution:** jak opravit
**Status:** fixed | active | monitoring
```

---

## undici@7 ReferenceError: File is not defined

**Signature:** `ReferenceError: File is not defined` v `undici/lib/web/webidl/index.js`  
**Context:** Spouštění testů s `tsx` na Node 18, pokud je nainstalován `undici@7`  
**Cause:** `cheerio@1.0` přidalo `fromURL` funkci, která závisí na `undici@7`. `undici@7` vyžaduje Node 20+ (`File` global dostupný bez `global.` prefixu). Node 18 sice má `File` od v18.0.0, ale interně jako `global.File`, což `undici@7` nenajde.  
**Solution:** Přidat do root `package.json` pnpm override: `"pnpm": { "overrides": { "undici": "^6" } }` a reinstalovat.  
**Status:** fixed

---

## parsePrice — European prices with space thousands separator

**Signature:** Cena `"1 234,56 Kč"` se parsuje jako `1` místo `1234.56`  
**Context:** `html-heuristics.ts` funkce `parsePrice()` — Cheerio `.text()` na elementech s cenou  
**Cause:** Po odstranění non-numeric chars zbyde `"1 234,56"`. Detekce `hasCommaDecimal` funguje správně, ale `replace(/\./g, '')` neodstraní mezery. `parseFloat("1 234.56")` zastaví na mezeře → vrátí `1`.  
**Solution:** V European větvi nahradit `cleaned.replace(/\./g, '')` za `cleaned.replace(/[\s.]/g, '')` — odstranit i mezery (thousands separator).  
**Status:** fixed
