import {
  DollarSign, AlertTriangle, MapPin,
  Navigation, TrendingUp, Wrench, Settings, ShieldAlert,
} from 'lucide-react'

// Fuente de verdad de los tipos de `notificaciones`. El CHECK
// `notificaciones_tipo_check` en la base tiene que seguir incluyendo todo lo de
// acá (ver migración 20260710120500) — pero puede tener DE MÁS sin romper nada.
//
// 'oportunidad' se retiró: era el tipo de los avisos de flete, que generaba un
// scraper de n8n externo al repo. El negocio ya no hace fletes. Las filas viejas
// de ese tipo siguen en la base y caen al fallback `?? TIPO_CONFIG.sistema` de
// NotifCenter y del toast de App.jsx, así que se muestran, sin estilo propio.
export const TIPO_CONFIG = {
  accion:        { color: '#f87171', Icon: ShieldAlert   },
  nomina:        { color: '#34d399', Icon: DollarSign    },
  vencimiento:   { color: '#fb923c', Icon: AlertTriangle },
  viaje:         { color: '#60a5fa', Icon: MapPin        },
  gps:           { color: '#22d3ee', Icon: Navigation    },
  finanzas:      { color: '#a78bfa', Icon: TrendingUp    },
  mantenimiento: { color: '#fbbf24', Icon: Wrench        },
  sistema:       { color: '#94a3b8', Icon: Settings      },
}
