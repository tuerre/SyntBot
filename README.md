# SyntBot

SyntBot es un bot de Discord pensado para mantener tu servidor seguro, ordenado y activo.
Incluye herramientas de moderación, protección automática, sugerencias y consultas útiles
para miembros y administradores.

## ¿Qué puede hacer?

- Aplicar bans, expulsiones, timeouts y avisos.
- Consultar el historial de moderación de cualquier usuario.
- Borrar mensajes masivamente y activar el modo lento.
- Bloquear o desbloquear canales durante una emergencia.
- Detectar spam y posibles raids automáticamente.
- Enviar alertas de seguridad a un canal dedicado.
- Enviar mensajes de bienvenida y despedida.
- Crear y gestionar sugerencias con votos ✅ y ❌.
- Presentar y revisar apelaciones de moderación.
- Consultar información del servidor, auditoría y estadísticas.
- Mostrar una guía de comandos con `/documentacion`.

## Comandos principales

### Moderación

| Comando | Función |
|---|---|
| `/ban` | Banea a un usuario. |
| `/unban` | Retira un ban usando el ID del usuario. |
| `/kick` | Expulsa a un usuario. |
| `/timeout` | Aísla temporalmente a un usuario. |
| `/untimeout` | Retira un timeout. |
| `/warn` | Registra un aviso. |
| `/warnings` | Muestra los avisos de un usuario. |
| `/clearwarns` | Limpia los avisos activos de un usuario. |
| `/purges` | Borra mensajes recientes del canal. |
| `/lockdown` / `/unlockdown` | Bloquea o desbloquea el canal actual. |
| `/slowmode` | Activa o desactiva el modo lento. |

### Consultas y comunidad

| Comando | Función |
|---|---|
| `/userinfo` | Muestra información de un usuario. |
| `/serverinfo` | Muestra información del servidor. |
| `/history` | Consulta el historial de infracciones. |
| `/case` | Consulta o anula un caso. |
| `/audit` | Consulta las acciones registradas del bot. |
| `/modlogs` | Consulta las acciones de un moderador y las filtra por tipo. |
| `/modstats` | Muestra estadísticas del equipo de moderación. |
| `/sugerencia` | Publica una sugerencia para que la comunidad vote. |
| `/apelacion` | Crea, consulta o resuelve apelaciones. |
| `/documentacion` | Abre la guía de comandos por categorías. |

## Seguridad automática

Estado real de los sistemas:

| Sistema | Estado |
|---|---|
| Sistema de puntos de infracción | 🚧 Pendiente de reglas acumulables configurables |
| AutoMod configurable | 🚧 Pendiente de palabras, expresiones regulares, spam, menciones y enlaces |
| Slowmode automático | 🚧 Pendiente de activación automática por spam |
| Filtro de palabras | 🚧 Pendiente de listas blanca/negra y excepciones |
| Cuarentena | 🚧 Pendiente de aislamiento temporal por canales |
| Protección contra cuentas nuevas | ✅ Disponible mediante reglas de antigüedad del anti-raid |
| Sistema de apelaciones | ✅ Disponible con `/apelacion` |
| Detección de reincidencia | 🚧 Pendiente de reglas entre distintos periodos |
| Detección de contenido tóxico | 🚧 Pendiente de clasificación y revisión |

Configura el canal donde se publican alertas de usuarios sospechosos, cuentas nuevas y posibles
raids con:

```text
/config alertas canal:#alertas
```

Si no se configura un canal de alertas, estas notificaciones se envían al canal de registros,
si existe.

### Escala recomendada de sanciones

- **Primera infracción:** advertencia registrada y explicación de la regla.
- **Segunda infracción:** timeout recomendado de 5 minutos.
- **Tercera infracción:** timeout recomendado de 1 hora y aviso al equipo.
- **Infracciones reiteradas o graves:** revisión de un moderador y posible expulsión o ban.

Esta escala es una referencia para el equipo. Las sanciones se aplican con `/warn`, `/timeout`,
`/kick` y `/ban`.

## Protección automática

### Anti-spam

Detecta ráfagas de mensajes, mensajes repetidos y exceso de menciones. Puede avisar, aplicar
timeout, expulsar o banear, además de registrar lo ocurrido.

### Anti-raid

Detecta muchas entradas en poco tiempo y activa medidas de protección para evitar ataques.

## Sugerencias

Las sugerencias se publican en un canal dedicado y reciben reacciones para votar:

- ✅ A favor
- ❌ En contra
- 🔒 Cerrar sugerencia

Los usuarios con permiso de **Gestionar servidor** pueden cerrar una sugerencia y dejar visibles
los votos finales.

## Organización del proyecto

```text
src/
├─ commands/
│  ├─ moderation/      Moderación y control de canales
│  ├─ information/     Consultas, auditoría y documentación
│  ├─ community/       Sugerencias y apelaciones
│  └─ configuration/   Configuración del servidor
├─ events/              Eventos de Discord
├─ services/            Anti-spam, anti-raid y moderación compartida
├─ database/            Supabase y acceso a datos
├─ config/              Variables de entorno
├─ utils/               Embeds y utilidades comunes
└─ core/                Carga de comandos y eventos
```

Cada comando pertenece a una categoría y se carga automáticamente, por lo que añadir una nueva
función no requiere modificar un registro central.
