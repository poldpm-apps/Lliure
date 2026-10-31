# Lliure

Els dies sense fumar, els diners que no gastes i les pastilles. Germana de
Nutrició, el cos i Finances: el mateix camp pàl·lid, la mateixa lletra, les
mateixes regles.

- **L'app:** <https://poldpm-apps.github.io/lliure/>
- **Les dades:** al mòbil (no hi ha full de càlcul). Si esborres les dades del
  navegador, les tornes a posar als Ajustos.
- **El servidor dels avisos:** un projecte d'Apps Script propi, «Lliure». Només
  serveix per avisar-te de les pastilles; la resta de l'app no el necessita.

## Com està fet

```
index.html               l'app sencera (pantalla i lògica)
sw.js                    perquè s'instal·li i s'obri sense cobertura
firebase-messaging-sw.js els avisos amb l'app tancada (abast ./fcm/)
firebase.config.json     configuració PÚBLICA de Firebase (jefe-f0832, la de les germanes)
apps-script/Codi.gs      el servidor dels avisos: un sol fitxer
```

## Les pastilles

La pauta és de 25 dies, de 6 a 2 comprimits:

| Dies | Al dia | Cada |
|---|---|---|
| 1–3 | 6 | 2 h |
| 4–12 | 5 | 2,5 h |
| 13–16 | 4 | 3 h |
| 17–20 | 3 | 5 h |
| 21–25 | 1–2 | — |

L'horari de cada dia surt de l'hora de la primera presa. Passat el dia 25, la
secció desapareix de l'app i el servidor esborra el seu automatisme: no hi ha
res a apagar.

## Posar en marxa els avisos (una sola vegada)

1. **Crea el projecte.** A <https://script.google.com>, *Projecte nou*, posa-li
   «Lliure» i enganxa-hi `apps-script/Codi.gs` (substitueix el que hi ha).
   A *Configuració del projecte*, zona horària **Europe/Madrid**.
2. **El compte de servei.** A *Configuració del projecte → Propietats de
   l'script*, afegeix `FIREBASE_COMPTE` amb **el mateix valor que té el
   projecte de Nutrició**.
3. **Executa `instala()`.** Accepta els permisos. Al registre surt la **clau
   d'accés**: copia-la.
4. **Desplega.** *Desplega → Desplegament nou → Aplicació web*. Executa com a
   **tu**; accés: **qualsevol**. Copia l'adreça que acaba en `/exec`.
5. **Al mòbil.** Obre l'app, *Ajustos*: posa el dia 1 de les pastilles i l'hora
   de la primera presa, i a *Avisos al mòbil* enganxa l'adreça i la clau.
   Prem **Activa els avisos** i després **Envia'n un de prova**.

Per comprovar-ho des de l'editor: `mostraEstat()` diu què hi ha desat i les
preses d'avui, i `provaNotificacio()` t'envia un avís.

## Com avisa

- Un automatisme cada minut mira si toca una presa. Si toca, no l'has marcada
  a l'app i no l'ha avisada ja, t'envia «Pastilla · 3 de 5 — Toca la de les
  13:00».
- Si l'automatisme s'encalla, una presa de fa més de 20 minuts ja no s'avisa:
  un avís tard no serveix.
- Del dia 21 al 25, un sol recordatori al dia, a l'hora de la primera presa.
- **Canvis de pauta:** els dies 4, 13, 17 i 21, a l'hora de la primera presa i
  just abans del seu avís, «Pauta nova» diu què canvia. El dia 25, «Últim dia».
  El dia 26 a la mateixa hora, «Tractament acabat», i l'automatisme s'esborra.
- **Si no la marques:** 10 minuts després de l'avís, «Pastilla pendent», i així
  cada 10 minuts fins que la marquis. Para quan toca la presa següent o al cap
  de 2 hores (`REPETEIX_CADA_MIN`, `REPETEIX_FINS_MIN`). L'app torna a enviar
  les marques del dia cada cop que l'obres, per si en vas fer cap sense cobertura.
- **«Presa ✓»:** l'avís de cada presa porta un botó que la marca sense obrir
  l'app. Ho diu al servidor i ho deixa a la memòria cau perquè l'app la mostri.
- Si canvies l'hora o el dia 1 als Ajustos, l'app li ho diu al servidor.

## Propietats de l'script

Mai al codi ni al repositori.

| Propietat | Per a què |
|---|---|
| `CLAU_ACCES` | la clau que enganxes a l'app; la crea `instala()` |
| `FIREBASE_COMPTE` | enviar avisos; el mateix que a Nutrició |
| `LLIURE_ESTAT` | el mòbil, la pauta i el que s'ha enviat; el gestiona l'script |

## Instal·lar-la al mòbil

Viu a `poldpm-apps.github.io`, com les germanes, i no a `poldpm.github.io`
(allà hi ha una app amagada que fa creure a Android que tot ja està
instal·lat). El manifest porta icones PNG, que és el que Android necessita.
L'`"id"` del manifest és `/lliure/` i no es canvia.
