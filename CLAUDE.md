# Palitos (nombre de trabajo): guerra de ejércitos de palitos

Proyecto propio de Aron (no es de un cliente). Segundo juego después de La Balsa (`../la-balsa`, `../la-balsa-roblox`). Lee esto antes de tocar nada.

## Qué es
Un juego de **guerra de ejércitos de palitos en una hoja de cuaderno**: dos bandos (lapicero **azul** contra lapicero **rojo**) juntan tinta, dibujan soldados y tratan de borrar el dibujo del rival. Dos versiones, igual que La Balsa:
- **TikTok LIVE:** el público elige bando y manda soldados con comentarios, likes y regalos.
- **Roblox:** el juego completo, donde tú mandas el ejército y además peleas como un palito más.

## Regla número uno: es un juego ORIGINAL
Aron pidió "algo como Stick War: Legacy pero mejor". Se toma **el género** (ejércitos que avanzan por un carril, economía, destruir la base rival), que es libre. **No se copia** ese juego: ni su nombre, ni sus unidades, ni su historia, ni su arte, ni su música, ni sus niveles. Tampoco se usa la palabra "Stick" en el título (hay una marca registrada con esa palabra en juegos). Si una idea solo se puede explicar diciendo "como en Stick War", se cambia.

## Decisiones (2026-11-11)
- Mundo propio: **hoja de cuaderno**, todo dibujado a mano con lapicero. Sale barato de dibujar, se reconoce al toque y no se parece a ningún juego de palitos conocido.
- Bandos: **Azul y Rojo** (colores de lapicero). Nada de países (Aron no quiere copiar los juegos de países de TikTok).
- Recurso: **tinta**. Base: **tu dibujo**. Perder = te pasan el **borrador**.
- Con plata (regalos o Robux) se compra **cómo se ve** y **diversión para todos**, nunca la victoria en Roblox. En TikTok los regalos sí mandan tropas (así es el formato), con tope para que un solo donador no decida la ronda.
- Nombre: **Palitos: Azul vs Rojo** (recomendado por Claude y aceptado por Aron el 2026-11-11; en Roblox con subtítulo en inglés, por ejemplo "Palitos ✏️ Doodle Army Battle"). Antes de publicar hay que revisar que no exista en Roblox, TikTok ni tiendas.
- Solo dos bandos al inicio. Más colores (verde, negro) pueden llegar como evento.
- Se empieza por **TikTok**. Roblox solo si el live engancha.
- **Primero se prueba La Balsa** (amigos en Roblox y un live). Palitos no empieza hasta entonces (decisión de Aron, 2026-11-11).

## Reglas de Aron que aplican aquí (las mismas de La Balsa)
- Escribirle en español peruano neutro, con "tú", corto y directo.
- No escribir contraseñas, API keys ni datos de pago. No comprar nada sin preguntar.
- No publicar nada sin su aprobación. Commits solo cuando él lo pida.
- Nunca dar objetos de Roblox a cambio de regalos de TikTok ni de pagos fuera de Roblox. Los códigos siempre son gratis para todos.

## Documentos
- `docs/investigacion.md`: qué se encontró (mercado, competencia, lo legal) y de dónde salió.
- `docs/diseno-juego.md`: cómo se juega en TikTok y en Roblox, unidades, poderes, cómo gana plata.
- `docs/plan.md`: todo lo que hay que hacer, por etapas, y qué decide si pega.

## Estado
- [x] Investigación y diseño (2026-11-11).
- [x] Decidido: cuaderno, Azul vs Rojo, nombre "Palitos: Azul vs Rojo", solo TikTok por ahora (Roblox después, si el live engancha).
- [x] **Prototipo de TikTok jugable (2026-11-11):** hoja de cuaderno, dos castillos, 7 unidades (Rayón, Tapa, Tirachinas, Compás, Plumón, **Resaltador** = mago cuyo rayo atraviesa, **Corrector** = curandero), Borrador, ejército automático por bando, entrar con `azul`/`rojo`/`1`/`2`, likes = tinta, seguir = Tapa, regalos = tropas, cartel grande con nombre y foto del que regala, topes por persona, ayuda al que va perdiendo y al bando con menos gente, castillos que se defienden y con tope de daño por segundo (sin eso las rondas duraban 45 s; con público simulado ahora duran entre 2 min 40 s y 3 min 30 s), mejor palito, ranking semanal, marcador de rondas, bots y panel de simulación. Visto corriendo en el navegador con bots, sin errores.
- [x] Pulido visual (2026-11-11): garabatos de impacto (¡PAF!), el golpeado retrocede y parpadea, al morir se desarma y un borrador chiquito lo limpia dejando marca, la hoja tiembla con los golpes grandes, garabatos de cuaderno de fondo (mancha de café, suma corregida, michi), el Plumón entra pintando una raya, el Borrador deja la franja limpia y arrugada, "Hoja nueva" voltea la página. Compartir = Corrector; regalo de 10 = mago.
- [x] 2026-11-12: **versión de Roblox empezada en `../palitos-roblox`** (idea distinta a la de TikTok: eres un palito con bando y clase; ver su CLAUDE.md). Escrita y compilada, sin correr en Studio todavía.
- [ ] Sin probar: un live real, regalos de verdad, cómo se ve bajo los botones de TikTok, el equilibrio entre unidades (números a ojo).
- [ ] Falta: voces o narrador, sonidos de verdad (ahora son pitidos sintetizados), el Gotero y los poderes Regla/Corrector/Sacapuntas/Mancha (quedaron para después: no hacían falta para probar si divierte), la venganza, cartel de Roblox.

## Estructura
- `logic.js`: reglas puras (unidades, combate, tinta, topes, regalos, ganador). `logic.test.js`: sus pruebas.
- `game.js`: dibuja en Canvas 2D, sonido y entrada única `window.handle(ev)`. `index.html`: la hoja y el panel.
- `server.js`, `tiktok.js`: copiados de La Balsa (puente TikTok → SSE). Puerto **5174**.
- `npm start` → http://localhost:5174 (simulador). `npm start -- usuario` conecta al live; en OBS: `?live&clean`. `?mudo` sin sonido. `npm test` corre las pruebas.

## Cómo se va a trabajar (propuesta)
- TikTok: hecho así: mismo armazón que La Balsa, dibujado en **Canvas 2D** por código (el trazo a mano es el estilo; Blender queda para el ícono y la miniatura).
- Roblox: Rojo + Lune, igual que `../la-balsa-roblox`, con la misma prueba automática de `tests/studio`.
