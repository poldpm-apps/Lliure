# Instruccions per a Claude Code

## Sincronització amb GitHub: automàtica, sempre

En Pol treballa des de diversos ordinadors (la torre, portàtils, el mòbil).
GitHub és l'única còpia que veuen tots. Per tant, **sense que ho demani**:

- **En començar** qualsevol conversa: `git pull` abans de tocar res. Si hi ha
  canvis locals sense desar o un conflicte, atura't i explica-li-ho.
- **En acabar cada canvi** (fet i comprovat): commit amb un missatge clar en
  català i `git push`. No cal preguntar-ho.
- ⚠ Si el repositori publica una web (GitHub Pages), **el push la publica**:
  famílies i mestres la veuen al moment. Push només quan el canvi està acabat
  i verificat, mai a mig fer.
- Si el pull o el push fallen, digues-ho clarament: si no, el canvi es queda
  en un sol ordinador i en Pol no ho sabrà.

## Aquesta app

- `index.html` és la font: s'edita directament (no hi ha pas de construcció).
- Família visual: Nutrició, el cos i Finances (`poldpm-apps`). Abans de canviar
  l'aspecte, mira'n el `DESIGN.md`: regles i no targetes, cap anell ni barra
  que s'ompli, l'ocre només per corregir.
- El servidor és `apps-script/Codi.gs`; es copia a mà al projecte d'Apps
  Script «Lliure» i es torna a desplegar (vegeu el README).
