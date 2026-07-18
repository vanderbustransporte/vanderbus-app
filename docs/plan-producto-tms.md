# Plan de producto: de "proyecto propio" a TMS completo

**Fecha:** 2026-07-18 · **Contexto:** el dueño pidió que cada apartado de la nav sea más completo
(Finanzas primero) y que el producto se nutra de lo que hacen las apps de logística exitosas.
Foco declarado del negocio: **custodia de camiones, viajes largos de camión, y los datos de carga
(peso, volumen, etc.) que las empresas se intercambian antes de empezar un viaje.**

---

## 1. Qué se investigó

**TMS internacionales exitosos** (qué módulos venden):

- **Alvys** — dispatch con drag & drop, tracking en tiempo real, facturación a un click,
  settlements (liquidaciones) por chofer, gestión documental central (rate confirmation, BOL,
  POD escaneados desde el celular del chofer), integración contable.
- **Rose Rocket** — órdenes, settlements automáticos con deducciones recurrentes (combustible,
  seguro), documentos al instante, gestión de choferes (licencias, certificaciones, comunicación
  dispatcher↔chofer).
- **McLeod / TMW.Suite** (estándar de la industria para flotas grandes) — ciclo completo
  *order-to-cash*: orden → despacho → ejecución → documentación → factura → cobro, con
  contabilidad, mantenimiento y payroll integrados.
- **Samsara / Motive** — telemetría, seguridad y cumplimiento (acá ya hay GPS propio).

**Argentina / LATAM:**

- **Avancargo** (AR, +17.000 transportistas) — administración de viajes, gestión de proveedores
  de transporte, seguimiento de unidades integrando +100 empresas satelitales (ubicación,
  velocidad, paradas, ETA), **gestión documental y administrativa**, métricas.
- **Transoft / Setup Transporte** — TMS locales clásicos: viajes, tarifas, cuentas corrientes,
  facturación, liquidación a choferes/fleteros.

**Práctica real de custodia y pre-viaje en AR** (fuentes: proyecto académico IUA sobre asignación
y seguimiento de cargas, C&R Seguridad, Carbess, CETACC):

- Cuando se confirma la unidad para una carga, el transportista manda por mail/WhatsApp **los
  datos de la unidad y del chofer** + coordenadas de carga.
- La **planilla de rastreo/monitoreo** diaria lleva: fecha, horario de carga, dador de carga,
  tipo de servicio, chofer, **patente de tractor y semi**, empresa satelital, custodia móvil,
  dador y destinatario.
- Si hay **custodia satelital**: se informa el acceso al equipo satelital de la unidad, se puede
  exigir certificado de funcionamiento del equipo antes de cargar (si falta, rechazan la unidad).
- **Precintos numerados y fotografiados**, planilla de inicio de custodia firmada, registro
  fotográfico de carga y entrega, verificación de precintos en destino.
- **Remito en triplicado** (cliente / transporte / destino). Carta de porte electrónica
  (RG 5176/2022 para cargas generales; régimen aparte para granos con CTG).
- **Orden de carga** típica: datos del dador y del transportista, mercadería (tipo, peso,
  medidas/volumen, bultos/pallets, valor declarado), dirección y ventana horaria de carga y
  descarga, tipo de vehículo requerido, elementos de sujeción, condiciones.

---

## 2. Dónde está parado Vanderbus hoy

Lo que ya está a nivel producto: multi-tenant con RLS, permisos por sección, GPS propio,
notificaciones de vencimientos, command palette, deep links, undo en borrados, dashboard
operativo. Eso es infraestructura que muchos TMS chicos no tienen.

Lo que falta es **profundidad de dominio**: el viaje de Vanderbus hoy es
`cliente + origen + destino + fecha + monto`. Para el negocio declarado (viajes largos con
custodia) faltan las tres capas que todos los exitosos tienen:

1. **La carga** — qué se lleva: tipo, peso, volumen, bultos/pallets, valor declarado, contenedor/vacío.
2. **La seguridad** — custodia satelital/móvil, empresa de custodia, precintos, equipo satelital.
3. **El intercambio** — la "ficha de despacho" que se manda a la otra empresa antes del viaje
   (unidad, chofer con DNI y celular, patentes, satelital, custodia, carga, remito).

---

## 3. Gaps por apartado de la nav

| Apartado | Hoy | Qué tienen los exitosos / qué falta |
|---|---|---|
| **Viajes** | fecha, cliente, origen/destino, montos, estado | **Despacho completo**: carga (tipo/peso/volumen/bultos/valor), chofer asignado, patente semi, custodia (empresa, tipo, custodio, precintos), empresa satelital + ID equipo, km estimados, ventanas horarias, referencia/orden, **ficha de despacho compartible** (texto WhatsApp/mail + impresión) |
| **Finanzas** | lista de ingresos/gastos + 3 tarjetas del mes | Resumen con evolución y desglose por categoría, **cuentas por cliente** (facturado, por cobrar), **rentabilidad por vehículo**, edición de movimientos, export CSV. *(→ implementado en esta fase, ver §5)* |
| **Flota** | ficha del vehículo + vencimientos | costo total de operación por unidad (viene con Rentabilidad), documentos adjuntos (título, cédula, seguro en PDF/foto), checklist pre-viaje |
| **Nómina** | pagos sueltos | **Choferes como entidad** (legajo): licencia y vencimiento, LiNTI/CNRT, DNI, celular, asignación a viajes; liquidaciones por período (estilo settlements) |
| **Contactos** | agenda simple | separar **Clientes** (cuenta corriente, condición de pago, CUIT) de **Proveedores** y agregar **Empresas de custodia / satelitales** como tipo |
| **GPS** | tracking propio | link de seguimiento **público** por viaje para compartir con el cliente (estilo project44/Avancargo) |
| **Documentos** | no existe | módulo transversal: remitos, cartas de porte, POD, fotos de precintos, seguros — Supabase Storage, adjuntos por viaje/vehículo/chofer |

---

## 4. Roadmap propuesto (fases)

**Fase A — Finanzas completa** *(hecha 2026-07-18, sin migración)* — ver §5.

**Fase B — Despacho completo (el corazón del negocio)** — *(código hecho 2026-07-18;
falta aplicar `supabase/migrations/20260718120000_viajes_despacho.sql` en el SQL editor —
la UI se auto-habilita al detectar las columnas)*. Campos agregados a `viajes`:

```
carga_tipo, carga_peso_kg, carga_volumen_m3, carga_bultos, carga_valor,
contenedor (bool/nro), vacio (bool),
chofer_id (FK a choferes, fase C; mientras: chofer_nombre, chofer_dni, chofer_cel),
patente_semi, km_estimados,
custodia_tipo (ninguna|satelital|fisica|ambas), custodia_empresa, custodia_contacto,
precintos (texto), satelital_empresa, satelital_id_equipo,
referencia (nro de orden del dador), destinatario
```

+ **Ficha de despacho**: botón en el viaje que arma el texto/impresión con todos los datos
(el "paquete pre-viaje" del §1) para mandar al dador/custodia. Es la feature más diferencial
y la más barata una vez que existen los campos.

**Fase C — Choferes** — *(código hecho 2026-07-18; falta aplicar
`supabase/migrations/20260718130000_choferes.sql` — el módulo se auto-habilita al detectar
la tabla)*. Legajo con licencia/habilitación/psicofísico y sus vencimientos enchufados a las
notificaciones; sección de permisos nueva `choferes`; selector de chofer en el despacho.
**Documentos adjuntos** (Supabase Storage) quedó para una fase propia, junto con Fase D.

**Fase D — Tracking público + portal** — link firmado de seguimiento por viaje; más adelante
portal del cliente.

Las fases B–D necesitan migraciones en `supabase/migrations/` + sincronizar el CHECK de
`notificaciones.tipo` si se agregan tipos nuevos (ver memoria del proyecto).

---

## 5. Fase A implementada: Finanzas

Reestructurada en 4 vistas (pestañas dentro del módulo):

- **Resumen** — KPIs del período (ingresos, gastos, resultado, por cobrar de viajes agendados),
  evolución 12 meses, gastos por categoría y top clientes, con selector de período.
- **Movimientos** — la tabla anterior + filtro por mes + **edición** (mismo patrón `editId` del
  resto de los módulos) + **export CSV** (separador `;`, BOM UTF-8, listo para Excel AR).
- **Clientes** — cuenta por cliente: facturado, viajes realizados, agendados, por cobrar
  (total − seña de Pendiente/Confirmado), última actividad.
- **Rentabilidad** — por vehículo: ingresos de viajes realizados vs combustible + mantenimiento,
  resultado y margen, con selector de período.

Sin cambios de esquema: todo derivado de `ingresos`, `gastos`, `viajes`, `combustible`,
`mantenimiento` y `vehiculos`.

---

## 6. Fuentes

- https://alvys.com/ y https://alvys.com/features/tms-dispatch-software
- https://www.roserocket.com/personas-pages/truckload-carriers
- https://www.torotms.com/blog/best-tms-software-for-trucking-company
- https://gofreight.com/blog/best-tms-trucking-companies
- https://avancargo.com/ y https://avancargo.com/servicios-saas/
- http://www.transoft.com.ar/tms.php · https://www.setupinformatica.com.ar/soluciones/por-producto/tms-setup-transporte
- Proyecto IUA "Asignación y seguimiento de cargas": https://rdu.iua.edu.ar/bitstream/123456789/759/1/
- https://www.cyrseguridad.com.ar/custodia-mercaderia/ · https://www.carbess.com.ar/id_sp/servicios-custodia-satelital.php
- Orden de carga: https://www.dashdoc.com/es/blog/orden-de-transporte · https://ibercondor.com/blog/orden-carga/
- Carta de porte cargas generales RG 5176/2022 (ARCA)
