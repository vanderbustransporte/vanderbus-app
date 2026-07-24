---
name: verify
description: Cómo levantar y verificar la app Vanderbus en el navegador real (receta probada)
---

# Verificar Vanderbus en runtime

1. `npm run dev` en la raíz del repo (background). Si el 5173 está ocupado Vite
   salta al 5174 — leer el output para saber el puerto real.
2. Abrir `http://localhost:<puerto>` con las herramientas de Chrome (claude-in-chrome).
3. Credenciales de prueba en `.env` (no versionado): `SUPERADMIN_EMAIL/PASSWORD`
   (superadmin, además owner del org Vanderbus), `TEST_ORG_B_EMAIL/PASSWORD`
   (org B de la suite RLS). Suele haber sesión ya iniciada (localStorage).
4. **Gotcha:** tipear contraseñas con `computer.type` puede fallar (autofill /
   tipeo simulado); usar `find` + `form_input` sobre el input de password.
5. Para leer valores exactos de la página (UUIDs, passwords generadas) usar
   `get_page_text`, no la captura de pantalla.
6. Probar caminos de Edge Functions sin crear datos: enviar un email ya
   registrado → 409 legible. El alta positiva crea una org REAL en prod:
   marcarla claramente (alias `+algo@gmail.com`) y anotarla para limpieza.
7. Al terminar: restaurar la sesión que estaba (login del superadmin) y parar
   el dev server propio (TaskStop), no matar procesos node (el usuario suele
   tener su propio server en 5173).
