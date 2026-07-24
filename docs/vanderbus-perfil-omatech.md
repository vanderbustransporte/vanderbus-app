# Vanderbus — perfil para la web de Omatech

Contenido realista y verificado contra el código, listo para rellenar la sección de
Vanderbus en la web de Omatech (OMA Technologies). Mismo material que la skill global
`vanderbus-showcase`. Adaptá el copy al formato del sitio; no inventes datos.

---

## Headline
**Vanderbus — Gestión integral para empresas de transporte**

## Subtítulo
Viajes, vehículos, finanzas y vencimientos de toda la flota en una sola app web, con
avisos automáticos y datos seguros por empresa.

## Descripción corta
Plataforma web que centraliza la operación diaria de una empresa de transporte: flota,
viajes, combustible, mantenimiento, finanzas y equipo, con notificaciones automáticas
de vencimientos y control de permisos por usuario.

## Descripción larga
Vanderbus es una aplicación de gestión pensada para empresas de transporte.
Surgió como herramienta interna de Vanderbus Transporte (Lomas de Zamora, AMBA) para
ordenar la operación de su flota y Omatech la está generalizando como SaaS
multi-empresa. Desde una única app web, cada empresa administra sus vehículos y su
documentación, registra viajes, combustible, mantenimiento, ingresos y gastos, y
gestiona a su equipo con permisos por sección. Un sistema de notificaciones avisa con
anticipación cuando está por vencer la VTV, el seguro o la habilitación de un vehículo,
o cuando toca el próximo service, e insiste con los datos obligatorios que falten
cargar. Todo con aislamiento de datos por empresa y seguridad a nivel de base de datos.

## Funcionalidades
- **Gestión de flota:** ficha técnica y documentación por vehículo (VTV, seguro,
  habilitación, aseguradora, póliza, kilometraje, capacidad).
- **Notificaciones de vencimientos:** avisos automáticos y escalonados (30 días, 7
  días, vencido) de VTV, seguro, habilitación y próximo service/cambio de aceite;
  además insiste con los datos obligatorios sin cargar.
- **Viajes:** registro con cliente, origen/destino, señas y montos.
- **Combustible:** cargas con litros, precio, total y km.
- **Mantenimiento:** historial de services/reparaciones con próximo vencimiento por
  fecha o kilometraje (aceite, filtros, frenos, etc.).
- **Finanzas:** ingresos y gastos categorizados, con control del mes.
- **Nómina:** registro de pagos al personal.
- **Contactos y Marketing:** agenda de contactos y seguimiento de campañas.
- **Seguimiento GPS en tiempo real** *(en integración):* ubicación de vehículos sobre mapa.
- **Usuarios y permisos:** roles owner/staff con permisos granulares por sección (ver/editar).
- **Multi-empresa (SaaS):** datos aislados por empresa con Row Level Security.
- **Backup y exportación** de datos; **tema claro/oscuro**; diseño responsive.

## Stack técnico
- **Frontend:** React 19 + Vite + Tailwind CSS 4 (SPA web)
- **Backend & datos:** Supabase (PostgreSQL, Auth, RLS, Realtime, Edge Functions)
- **Mapas:** Leaflet + OpenStreetMap · **Gráficos:** Recharts
- **Automatizaciones:** n8n
- **Arquitectura:** serverless, multi-tenant

## Estado
En desarrollo activo. Piloto real en Vanderbus Transporte y en proceso de
generalización a SaaS multi-empresa.

---

## Qué NO afirmar (para no mentir)
- Sin métricas inventadas (usuarios/empresas/uptime). Adopción real: piloto en Vanderbus Transporte.
- El SaaS no está lanzado comercialmente: está en desarrollo/transición.
- GPS: "en integración", no 100% disponible.
- Es app web: no prometer apps nativas iOS/Android, IA ni integraciones fuera de la lista.
- Arquitectura serverless sobre Supabase (sin backend propio de servidores).
