# Thrall Survivors — prototipo

Fan prototype de *bullet-heaven* (estilo Vampire Survivors) ambientado en Azeroth.
**Sin afiliación con Blizzard Entertainment.** Todo el arte está **dibujado por código**
(Canvas 2D): no se usa ningún asset con copyright. Proyecto personal, no comercial.

## Jugar

Abre `index.html` en el navegador (o la versión publicada en GitHub Pages).

| Acción | Tecla |
|---|---|
| Mover | `WASD` / flechas |
| Móvil | arrastra el dedo (joystick flotante) |
| Pausa | `P` o `Espacio` |
| Ataque | automático (martillo en arco frontal) |
| Habilidad | **Cadena de relámpagos** ⚡ (automática, con enfriamiento) |

**Objetivo:** sobrevivir 5 minutos y matar al **Khan de los Centauros**.

## Contenido del prototipo

- **Héroe único:** Thrall (orco chamán) con una habilidad — Cadena de relámpagos.
- **Enemigos comunes:** Kobold (con vela), Murloc, Gnoll, Lobo · **jefe:** Khan de los Centauros.
- **Objetos:** pociones de vida, recarga de habilidad, y **10 mejoras** en draft de 3 cartas al subir de nivel.
- **Mapa:** pradera de Azeroth con árboles, rocas, arbustos y un camino de tierra (2600×2600).
- Oleadas crecientes: 4 tipos de enemigo que se desbloquean con el tiempo y escalan vida/daño.

## Estructura

```
index.html       HUD, pantallas (inicio / subida de nivel / final)
game.js          motor completo (canvas, oleadas, draft, efectos)
test_smoke.js    test de humo: mock de DOM+canvas, 24.000 frames simulados
```

## Tests

```bash
node test_smoke.js                          # partida completa (5 min simulados)
RUN_TIME=20 BOSS_HP=90 node test_smoke.js   # jefe acelerado → verifica la victoria
```

Hooks de test (opcionales, solo para automatizar): `window.__RUN_TIME`, `window.__BOSS_HP`.

## Estado

Prototipo jugable. Siguiente paso natural: más héroes, más habilidades, meta-progresión
y sprites en lugar de dibujo por código.
