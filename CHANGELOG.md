# Changelog – LSS Lern-App

## v1.1.7 – 2026-06-25 (OTA 88aa7a6f)

- **Fix: Weitermachen wo aufgehört** – App-Neustart und Tab-Wechsel zeigen jetzt dieselbe Frage wie zuvor; `ROUND_STATE` speichert `currentId` und wird in `handleAnswer` + `handleNext` aktualisiert
- **Lesbare Versionsanzeige** – Einstellungen zeigt `Stand: v1.1.7 · TT.MM.JJJJ` statt kryptischer Update-Hash-ID
- **Release-Notes-Button** – „Was ist neu?" in App-Info öffnet GitHub-Releases

---

## v1.1.6 + v1.1.5 – 2026-06-25 (OTA 5ff4413a)

### v1.1.6 – Prüfungsauswahl & Streak-Fix
- **Standard-Prüfung-Preset**: Ein Button aktiviert alle Prüfungs-Module (LSS BB, PMI, Scrum, Digi) und setzt den Rundenstand zurück
- **Mitschrift-Kernstoff**: Filter „Nur Mitschrift-Kernstoff" wirkt jetzt auf alle aktiven Module (inkl. Vertiefung), filtert nach `fundstelle` ≠ leer
- **Streak-Fix**: App erkennt verpasste Tage auch ohne Lernaktivität und setzt Streak zurück

### v1.1.5 – Falsch-Filter, Runden-Fortschritt, Modul-Reset
- **Nur-falsch-Filter**: Toggle in LearnScreen – zeigt nur falsch beantwortete Fragen (mit Anzahl-Badge)
- **Runden-Fortschritt wird gespeichert**: Round-Robin-Stand bleibt nach App-Neustart erhalten, solange Auswahl/Module gleich
- **Modul-Reset**: ↺-Button pro Modul im Module-Screen – setzt Fortschritt nach Bestätigung zurück
- **OTA-Update-Stand**: Einstellungen zeigt Update-ID und Datum des aktiven OTA-Updates

---

## v1.1.4 – 2026-06-11 (OTA 7a61071d)
- Runde-2-Audit: 28 Module, 2349 Fragen gesamt
- Neues Modul: Sales & KAM-Excellence (55 Fragen)
- Fundstelle-Anzeige in allen Kartentypen
- Forbidden-term-Fix: fmea_qfd_014 + fmea_qfd_k008

---

## v1.1.3c/d/e – 2026-06-11 (OTA 695ed3d7)
- Dashboard-Filter nur aktive Module; „Falsch"-Zähler entfernt aus LearnScreen
- Ganzzahlige Versuchszähler (`attempts`)
- Export-Fix: expo-file-system/legacy für SDK 54
- Einheitliches Basisgewicht 10; Tagesziel-Optionen [15, 25, 50, 75, 100]
- Dynamischer Benachrichtigungstext mit verbleibender Anzahl

---

## v1.1.1 / v1.1 – 2026-06-01
- Initialrelease: 17 LSS-Module, Spaced-Repetition, Dark/Light-Mode, Lernmodi, Streak
